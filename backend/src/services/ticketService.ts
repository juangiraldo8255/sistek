import pool from '../config/database';
import { createNotification } from './notificationService';

export const VALID_PRIORITIES = ['Alta', 'Media', 'Baja'] as const;
export type Priority = typeof VALID_PRIORITIES[number];

// Crea ticket_historia si no existe (tabla renombrada durante la migración)
export const createTicketHistoriaTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_historia (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      usuario_accion_id INTEGER NOT NULL REFERENCES users(id),
      tipo_accion VARCHAR(50) NOT NULL,
      valor_anterior TEXT,
      valor_nuevo TEXT,
      fecha_registro TIMESTAMP DEFAULT NOW()
    )
  `);
};

export const migratePrioritiesToNewValues = async () => {
  await pool.query(`UPDATE tickets SET priority = 'Alta' WHERE priority IN ('alto', 'urgente')`);
  await pool.query(`UPDATE tickets SET priority = 'Media' WHERE priority = 'medio'`);
  await pool.query(`UPDATE tickets SET priority = 'Baja' WHERE priority = 'bajo'`);

  // Actualizar el CHECK constraint de la BD buscándolo por nombre en el catálogo
  await pool.query(`
    DO $$
    DECLARE v_name text;
    BEGIN
      SELECT conname INTO v_name
      FROM pg_constraint pc
      JOIN pg_class pt ON pc.conrelid = pt.oid
      WHERE pt.relname = 'tickets' AND pc.contype = 'c'
        AND pg_get_constraintdef(pc.oid) LIKE '%priority%'
      LIMIT 1;
      IF v_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE tickets DROP CONSTRAINT ' || quote_ident(v_name);
      END IF;
      ALTER TABLE tickets ADD CONSTRAINT tickets_priority_check
        CHECK (priority IN ('Alta', 'Media', 'Baja'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
};

// Obtener todos los tickets
export const getAllTickets = async () => {
  const result = await pool.query(
    'SELECT t.*, u.username as creator FROM tickets t LEFT JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC'
  );
  return result.rows;
};

// Obtener un ticket por ID
export const getTicketById = async (id: number) => {
  const result = await pool.query(
    'SELECT t.*, u.username as creator, a.username as assigned_agent FROM tickets t LEFT JOIN users u ON t.user_id = u.id LEFT JOIN users a ON t.assigned_agent_id = a.id WHERE t.id = $1',
    [id]
  );
  return result.rows[0];
};

// Obtener tickets de un usuario (cliente)
export const getUserTickets = async (userId: number) => {
  const result = await pool.query(
    'SELECT t.*, u.username as creator, a.username as assigned_agent FROM tickets t LEFT JOIN users u ON t.user_id = u.id LEFT JOIN users a ON t.assigned_agent_id = a.id WHERE t.user_id = $1 ORDER BY t.created_at DESC',
    [userId]
  );
  return result.rows;
};

// Obtener tickets asignados a un agente
export const getAgentTickets = async (agentId: number) => {
  const result = await pool.query(
    'SELECT t.*, u.username as creator, a.username as assigned_agent FROM tickets t LEFT JOIN users u ON t.user_id = u.id LEFT JOIN users a ON t.assigned_agent_id = a.id WHERE t.assigned_agent_id = $1 ORDER BY t.created_at DESC',
    [agentId]
  );
  return result.rows;
};

// Crear ticket (HU-3)
export const createTicket = async (
  title: string,
  description: string,
  priority: string,
  type: string,
  userId: number
) => {
  if (!VALID_PRIORITIES.includes(priority as Priority)) {
    throw new Error(`Prioridad inválida. Valores permitidos: ${VALID_PRIORITIES.join(', ')}`);
  }
  const result = await pool.query(
    'INSERT INTO tickets (title, description, priority, type, status, user_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *',
    [title, description, priority, type, 'Abierto', userId]
  );
  return result.rows[0];
};

// Actualizar estado del ticket (HU-6)
// Actualizar estado del ticket (HU-6)
export const updateTicketStatus = async (ticketId: number, newStatus: string, changedBy: number) => {
  // 1. Obtener el estado actual antes de cambiarlo
  const currentTicket = await getTicketById(ticketId);
  if (!currentTicket) {
    throw new Error('Ticket no encontrado');
  }
  const statusAnterior = currentTicket.status;

  // 2. Actualizar el ticket en la tabla 'tickets'
  const result = await pool.query(
    'UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [newStatus, ticketId]
  );

  // 3. Registrar en historial (HU-007)
  await pool.query(
    'INSERT INTO ticket_historia (ticket_id, usuario_accion_id, tipo_accion, valor_anterior, valor_nuevo) VALUES ($1, $2, $3, $4, $5)',
    [ticketId, changedBy, 'status_change', statusAnterior, newStatus]
  );

  return result.rows[0];
};

// Asignar ticket a agente (HU-5)
// Asignar ticket a agente (HU-5) - Versión con Historial (HU-007)
export const assignTicketToAgent = async (ticketId: number, agentId: number, assignedBy: number) => {
  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    throw new Error('Ticket no encontrado');
  }

  // 1. Validar que el agente existe y tiene rol 'agente'
  const agent = await pool.query('SELECT id, role FROM users WHERE id = $1', [agentId]);
  if (agent.rows.length === 0 || agent.rows[0].role !== 'agente') {
    throw new Error('El usuario asignado no es un agente válido');
  }

  // 2. Asignar ticket en la tabla 'tickets'
  const result = await pool.query(
    'UPDATE tickets SET assigned_agent_id = $1, assigned_date = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *',
    [agentId, ticketId]
  );

  // 3. REGISTRAR EN HISTORIAL (HU-007)
  // Aquí usamos la tabla 'ticket_historia' que creamos en Railway
  await pool.query(
    'INSERT INTO ticket_historia (ticket_id, usuario_accion_id, tipo_accion, valor_anterior, valor_nuevo) VALUES ($1, $2, $3, $4, $5)',
    [ticketId, assignedBy, 'agent_assignment', 'Ninguno', agentId.toString()]
  );

  // 4. CREAR NOTIFICACIÓN PARA EL AGENTE (HU notificaciones)
  await createNotification(agentId, ticketId);

  return result.rows[0];
};

// Actualizar prioridad de un ticket (HU prioridad)
export const updateTicketPriority = async (ticketId: number, newPriority: string, changedBy: number) => {
  if (!VALID_PRIORITIES.includes(newPriority as Priority)) {
    throw new Error(`Prioridad inválida. Valores permitidos: ${VALID_PRIORITIES.join(', ')}`);
  }

  const current = await getTicketById(ticketId);
  if (!current) throw new Error('Ticket no encontrado');

  const result = await pool.query(
    'UPDATE tickets SET priority = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [newPriority, ticketId]
  );

  await pool.query(
    'INSERT INTO ticket_historia (ticket_id, usuario_accion_id, tipo_accion, valor_anterior, valor_nuevo) VALUES ($1, $2, $3, $4, $5)',
    [ticketId, changedBy, 'priority_change', current.priority, newPriority]
  );

  return result.rows[0];
};

// Eliminar ticket
export const deleteTicket = async (ticketId: number) => {
  const result = await pool.query('DELETE FROM tickets WHERE id = $1 RETURNING *', [ticketId]);
  return result.rows[0];
};

// Buscar tickets por palabra clave en título o descripción
export const searchTickets = async (keyword: string, userId: number, role: string) => {
  const pattern = `%${keyword}%`;

  if (role === 'administrador') {
    const result = await pool.query(
      `SELECT t.*, u.username as creator, a.username as assigned_agent
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN users a ON t.assigned_agent_id = a.id
       WHERE (t.title ILIKE $1 OR t.description ILIKE $1)
       ORDER BY t.created_at DESC`,
      [pattern]
    );
    return result.rows;
  }

  if (role === 'agente') {
    const result = await pool.query(
      `SELECT t.*, u.username as creator, a.username as assigned_agent
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN users a ON t.assigned_agent_id = a.id
       WHERE t.assigned_agent_id = $1
         AND (t.title ILIKE $2 OR t.description ILIKE $2)
       ORDER BY t.created_at DESC`,
      [userId, pattern]
    );
    return result.rows;
  }

  // cliente
  const result = await pool.query(
    `SELECT t.*, u.username as creator, a.username as assigned_agent
     FROM tickets t
     LEFT JOIN users u ON t.user_id = u.id
     LEFT JOIN users a ON t.assigned_agent_id = a.id
     WHERE t.user_id = $1
       AND (t.title ILIKE $2 OR t.description ILIKE $2)
     ORDER BY t.created_at DESC`,
    [userId, pattern]
  );
  return result.rows;
};

// Obtener historial de cambios (HU-7)
export const getTicketHistory = async (ticketId: number) => {
  const result = await pool.query(
    `SELECT th.*, u.username as nombre_usuario
     FROM ticket_historia th
     LEFT JOIN users u ON th.usuario_accion_id = u.id
     WHERE th.ticket_id = $1
     ORDER BY th.fecha_registro DESC`,
    [ticketId]
  );
  return result.rows;
};

// Reabrir ticket (HU-019)
export const reopenTicket = async (
  ticketId: number,
  userId: number,
  userRole: string,
  motivo: string
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener el ticket actual
    const ticketRes = await client.query(
      `SELECT t.*, u.username as creator
       FROM tickets t LEFT JOIN users u ON t.user_id = u.id
       WHERE t.id = $1`,
      [ticketId]
    );
    const ticket = ticketRes.rows[0];
    if (!ticket) throw new Error('Ticket no encontrado');
    if (ticket.status !== 'Cerrado') throw new Error('Solo se pueden reabrir tickets con estado "Cerrado"');

    // Validar permisos por rol
    if (userRole === 'cliente' && ticket.user_id !== userId) {
      throw new Error('No tienes permisos para reabrir este ticket');
    }
    if (userRole === 'agente' && ticket.assigned_agent_id !== userId) {
      throw new Error('Solo puedes reabrir tickets asignados a ti');
    }

    // 2. Restricción de 30 días para clientes
    if (userRole === 'cliente') {
      const cierreRes = await client.query(
        `SELECT fecha_registro FROM ticket_historia
         WHERE ticket_id = $1 AND tipo_accion = 'status_change' AND valor_nuevo = 'Cerrado'
         ORDER BY fecha_registro DESC LIMIT 1`,
        [ticketId]
      );
      const fechaCierre = cierreRes.rows.length > 0
        ? new Date(cierreRes.rows[0].fecha_registro)
        : new Date(ticket.updated_at);

      const diasTranscurridos = (Date.now() - fechaCierre.getTime()) / (1000 * 60 * 60 * 24);
      if (diasTranscurridos > 30) {
        throw new Error(
          `Han pasado ${Math.floor(diasTranscurridos)} días desde el cierre del ticket. ` +
          'El plazo máximo para reabrirlo es de 30 días. Por favor, crea un nuevo ticket.'
        );
      }
    }

    // 3. Cambiar estado a "En progreso"
    await client.query(
      'UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2',
      ['En progreso', ticketId]
    );

    // 4. Registrar en historial con tipo 'reopen'
    await client.query(
      `INSERT INTO ticket_historia
         (ticket_id, usuario_accion_id, tipo_accion, valor_anterior, valor_nuevo)
       VALUES ($1, $2, 'reopen', 'Cerrado', $3)`,
      [ticketId, userId, `En progreso | Motivo: ${motivo}`]
    );

    // 5. Guardar comentario con el motivo
    await client.query(
      `INSERT INTO comments (ticket_id, user_id, content) VALUES ($1, $2, $3)`,
      [ticketId, userId, `[Reapertura] ${motivo}`]
    );

    // 6. Notificar al agente asignado (si existe)
    if (ticket.assigned_agent_id) {
      await client.query(
        'INSERT INTO notifications (user_id, ticket_id) VALUES ($1, $2)',
        [ticket.assigned_agent_id, ticketId]
      );
    }

    await client.query('COMMIT');

    const updatedRes = await client.query(
      `SELECT t.*, u.username as creator, a.username as assigned_agent
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN users a ON t.assigned_agent_id = a.id
       WHERE t.id = $1`,
      [ticketId]
    );
    return updatedRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
