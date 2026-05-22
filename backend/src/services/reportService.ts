import pool from '../config/database';
import { getRatingsStats } from './ratingService';

export interface ReportFilters {
  start_date?: string;
  end_date?: string;
  agent_id?: number;
  status?: string;
}

export const getReportData = async (filters: ReportFilters) => {
  const { start_date, end_date, agent_id, status } = filters;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (start_date) {
    conditions.push(`t.created_at >= $${idx}::date`);
    params.push(start_date);
    idx++;
  }
  if (end_date) {
    conditions.push(`t.created_at < ($${idx}::date + INTERVAL '1 day')`);
    params.push(end_date);
    idx++;
  }
  if (agent_id) {
    conditions.push(`t.assigned_agent_id = $${idx}`);
    params.push(agent_id);
    idx++;
  }
  if (status) {
    conditions.push(`t.status = $${idx}`);
    params.push(status);
    idx++;
  }

  const ticketWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const agentWhere = conditions.length > 0
    ? `WHERE t.assigned_agent_id IS NOT NULL AND ${conditions.join(' AND ')}`
    : `WHERE t.assigned_agent_id IS NOT NULL`;

  // Métricas generales + promedio de resolución
  const resumenResult = await pool.query(`
    SELECT
      COUNT(*)::int                                                                  AS total,
      COUNT(*) FILTER (WHERE t.status = 'Abierto')::int                             AS abiertos,
      COUNT(*) FILTER (WHERE t.status = 'En progreso')::int                         AS en_progreso,
      COUNT(*) FILTER (WHERE t.status = 'Cerrado')::int                             AS cerrados,
      COUNT(*) FILTER (WHERE t.priority = 'Alta')::int                              AS alta,
      COUNT(*) FILTER (WHERE t.priority = 'Media')::int                             AS media,
      COUNT(*) FILTER (WHERE t.priority = 'Baja')::int                              AS baja,
      ROUND(
        AVG(
          EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 3600.0
        ) FILTER (WHERE t.status = 'Cerrado')::numeric, 1
      )                                                                              AS avg_resolucion_horas
    FROM tickets t
    ${ticketWhere}
  `, params);

  // Promedio de tiempo de respuesta
  const responseResult = await pool.query(`
    SELECT ROUND(
      AVG(
        EXTRACT(EPOCH FROM (primera_respuesta.fecha_registro - t.created_at)) / 3600.0
      )::numeric, 1
    ) AS avg_respuesta_horas
    FROM tickets t
    JOIN (
      SELECT DISTINCT ON (ticket_id) ticket_id, fecha_registro
      FROM ticket_historia
      WHERE tipo_accion = 'status_change' AND valor_nuevo = 'En progreso'
      ORDER BY ticket_id, fecha_registro ASC
    ) primera_respuesta ON primera_respuesta.ticket_id = t.id
    ${ticketWhere}
  `, params);

  // Tickets por agente: total, cerrados, abiertos, en progreso
  const agentResult = await pool.query(`
    SELECT
      a.username                                                    AS agente,
      COUNT(t.id)::int                                              AS total,
      COUNT(*) FILTER (WHERE t.status = 'Cerrado')::int            AS cerrados,
      COUNT(*) FILTER (WHERE t.status = 'Abierto')::int            AS abiertos,
      COUNT(*) FILTER (WHERE t.status = 'En progreso')::int        AS en_progreso,
      ROUND(
        AVG(
          EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 3600.0
        ) FILTER (WHERE t.status = 'Cerrado')::numeric, 1
      )                                                             AS avg_resolucion_horas
    FROM tickets t
    JOIN users a ON t.assigned_agent_id = a.id
    ${agentWhere}
    GROUP BY a.id, a.username
    ORDER BY total DESC
  `, params);

  // Métricas de satisfacción respetando los mismos filtros de fecha y agente
  const calificaciones = await getRatingsStats({
    start_date: filters.start_date,
    end_date:   filters.end_date,
    agent_id:   filters.agent_id,
  });

  return {
    resumen: {
      ...resumenResult.rows[0],
      avg_respuesta_horas: responseResult.rows[0]?.avg_respuesta_horas ?? null,
    },
    por_agente: agentResult.rows,
    calificaciones,
  };
};

export const getTicketsForExport = async (filters: ReportFilters) => {
  const { start_date, end_date, agent_id, status } = filters;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (start_date) {
    conditions.push(`t.created_at >= $${idx}::date`);
    params.push(start_date);
    idx++;
  }
  if (end_date) {
    conditions.push(`t.created_at < ($${idx}::date + INTERVAL '1 day')`);
    params.push(end_date);
    idx++;
  }
  if (agent_id) {
    conditions.push(`t.assigned_agent_id = $${idx}`);
    params.push(agent_id);
    idx++;
  }
  if (status) {
    conditions.push(`t.status = $${idx}`);
    params.push(status);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(`
    SELECT
      t.id,
      t.title,
      t.description,
      t.status,
      t.priority,
      c.username                                                          AS creado_por,
      a.username                                                          AS agente_asignado,
      t.created_at,
      t.updated_at,
      CASE WHEN t.status = 'Cerrado'
        THEN ROUND(
          (EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 3600.0)::numeric, 1
        )
        ELSE NULL
      END                                                                AS resolucion_horas,
      r.puntuacion                                                        AS calificacion,
      r.comentario                                                        AS comentario_calificacion
    FROM tickets t
    JOIN users c ON t.user_id = c.id
    LEFT JOIN users a ON t.assigned_agent_id = a.id
    LEFT JOIN ticket_ratings r ON r.ticket_id = t.id
    ${where}
    ORDER BY t.created_at DESC
  `, params);

  return result.rows;
};
