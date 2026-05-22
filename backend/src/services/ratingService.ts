import pool from '../config/database';

export const createRatingsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_ratings (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
      cliente_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      agente_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      puntuacion SMALLINT NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
      comentario TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
};

export const getRatingByTicket = async (ticketId: number) => {
  const result = await pool.query(
    'SELECT * FROM ticket_ratings WHERE ticket_id = $1',
    [ticketId]
  );
  return result.rows[0] ?? null;
};

export const createRating = async (
  ticketId: number,
  clienteId: number,
  agenteId: number | null,
  puntuacion: number,
  comentario?: string
) => {
  const result = await pool.query(
    `INSERT INTO ticket_ratings (ticket_id, cliente_id, agente_id, puntuacion, comentario)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [ticketId, clienteId, agenteId ?? null, puntuacion, comentario?.trim() || null]
  );
  return result.rows[0];
};

export interface RatingsFilters {
  start_date?: string;
  end_date?: string;
  agent_id?: number;
}

export const getRatingsStats = async (filters: RatingsFilters = {}) => {
  const { start_date, end_date, agent_id } = filters;

  // ── Métricas generales ───────────────────────────────────────────────────
  // Siempre limitado a tickets cerrados (solo ellos pueden tener calificación).
  // No se aplica el filtro `status` del reporte: las calificaciones son un
  // dominio propio del estado "Cerrado".
  const genConds: string[] = ["t.status = 'Cerrado'"];
  const genParams: any[] = [];
  let gi = 1;

  if (start_date) { genConds.push(`t.created_at >= $${gi}::date`);                          genParams.push(start_date); gi++; }
  if (end_date)   { genConds.push(`t.created_at < ($${gi}::date + INTERVAL '1 day')`);      genParams.push(end_date);   gi++; }
  if (agent_id)   { genConds.push(`t.assigned_agent_id = $${gi}`);                           genParams.push(agent_id);   gi++; }

  const genWhere = `WHERE ${genConds.join(' AND ')}`;

  const generalResult = await pool.query(`
    SELECT
      COUNT(t.id)::int                                                              AS cerrados_total,
      COUNT(r.id)::int                                                              AS calificados,
      (COUNT(t.id) - COUNT(r.id))::int                                             AS no_calificados,
      ROUND(AVG(r.puntuacion)::numeric, 2)                                         AS promedio_general,
      ROUND(
        100.0 * COUNT(r.id) FILTER (WHERE r.puntuacion >= 4)
        / NULLIF(COUNT(r.id), 0)::numeric, 1
      )                                                                            AS pct_satisfaccion,
      COUNT(r.id) FILTER (WHERE r.puntuacion = 1)::int                             AS estrellas_1,
      COUNT(r.id) FILTER (WHERE r.puntuacion = 2)::int                             AS estrellas_2,
      COUNT(r.id) FILTER (WHERE r.puntuacion = 3)::int                             AS estrellas_3,
      COUNT(r.id) FILTER (WHERE r.puntuacion = 4)::int                             AS estrellas_4,
      COUNT(r.id) FILTER (WHERE r.puntuacion = 5)::int                             AS estrellas_5
    FROM tickets t
    LEFT JOIN ticket_ratings r ON r.ticket_id = t.id
    ${genWhere}
  `, genParams);

  // ── Métricas por agente ──────────────────────────────────────────────────
  // Filtramos las calificaciones mediante un subquery que une con tickets,
  // respetando start_date, end_date (sobre t.created_at). Mostramos TODOS los
  // agentes aunque no tengan calificaciones (LEFT JOIN).
  const subConds: string[] = ["t.status = 'Cerrado'"];
  const agParams: any[] = [];
  let ai = 1;

  if (start_date) { subConds.push(`t.created_at >= $${ai}::date`);                     agParams.push(start_date); ai++; }
  if (end_date)   { subConds.push(`t.created_at < ($${ai}::date + INTERVAL '1 day')`); agParams.push(end_date);   ai++; }

  const subWhere = subConds.join(' AND ');

  const agentConds: string[] = ["u.role = 'agente'"];
  if (agent_id) { agentConds.push(`u.id = $${ai}`); agParams.push(agent_id); }

  const agentWhere = agentConds.join(' AND ');

  const agentResult = await pool.query(`
    SELECT
      u.id                                                                          AS agente_id,
      u.username                                                                    AS agente,
      COUNT(r.id)::int                                                             AS total_calificaciones,
      ROUND(AVG(r.puntuacion)::numeric, 2)                                         AS promedio_calificacion,
      ROUND(
        100.0 * COUNT(r.id) FILTER (WHERE r.puntuacion >= 4)
        / NULLIF(COUNT(r.id), 0)::numeric, 1
      )                                                                            AS pct_satisfaccion,
      COUNT(r.id) FILTER (WHERE r.puntuacion = 1)::int                             AS estrellas_1,
      COUNT(r.id) FILTER (WHERE r.puntuacion = 2)::int                             AS estrellas_2,
      COUNT(r.id) FILTER (WHERE r.puntuacion = 3)::int                             AS estrellas_3,
      COUNT(r.id) FILTER (WHERE r.puntuacion = 4)::int                             AS estrellas_4,
      COUNT(r.id) FILTER (WHERE r.puntuacion = 5)::int                             AS estrellas_5
    FROM users u
    LEFT JOIN (
      SELECT r.*
      FROM ticket_ratings r
      JOIN tickets t ON r.ticket_id = t.id
      WHERE ${subWhere}
    ) r ON r.agente_id = u.id
    WHERE ${agentWhere}
    GROUP BY u.id, u.username
    ORDER BY promedio_calificacion DESC NULLS LAST, total_calificaciones DESC
  `, agParams);

  return {
    general: generalResult.rows[0],
    por_agente: agentResult.rows,
  };
};
