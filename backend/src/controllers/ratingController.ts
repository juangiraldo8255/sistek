import { Request, Response } from 'express';
import pool from '../config/database';
import * as ratingService from '../services/ratingService';
import * as ticketService from '../services/ticketService';

const EXPIRY_DAYS = 7;

// Calificar un ticket (HU-021) - solo cliente propietario
export const rateTicket = async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { puntuacion, comentario } = req.body;
    const userId = req.userId!;
    const userRole = req.userRole!;

    if (userRole !== 'cliente') {
      return res.status(403).json({ error: 'Solo los clientes pueden calificar tickets' });
    }

    const score = parseInt(String(puntuacion));
    if (isNaN(score) || score < 1 || score > 5) {
      return res.status(400).json({ error: 'La puntuación debe ser un número entre 1 y 5' });
    }

    const ticket = await ticketService.getTicketById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    if (ticket.user_id !== userId) {
      return res.status(403).json({ error: 'Solo puedes calificar tus propios tickets' });
    }

    if (ticket.status !== 'Cerrado') {
      return res.status(400).json({ error: 'Solo se pueden calificar tickets cerrados' });
    }

    // Buscar la fecha de cierre más reciente en el historial
    const cierreRes = await pool.query(
      `SELECT fecha_registro FROM ticket_historia
       WHERE ticket_id = $1 AND tipo_accion = 'status_change' AND valor_nuevo = 'Cerrado'
       ORDER BY fecha_registro DESC LIMIT 1`,
      [ticketId]
    );
    const fechaCierre = cierreRes.rows.length > 0
      ? new Date(cierreRes.rows[0].fecha_registro)
      : new Date(ticket.updated_at);

    const diasTranscurridos = (Date.now() - fechaCierre.getTime()) / (1000 * 60 * 60 * 24);
    if (diasTranscurridos > EXPIRY_DAYS) {
      return res.status(400).json({
        error: `El plazo para calificar este ticket ha expirado. Han pasado ${Math.floor(diasTranscurridos)} días desde el cierre (máximo ${EXPIRY_DAYS} días).`,
        expired: true,
      });
    }

    const existing = await ratingService.getRatingByTicket(ticketId);
    if (existing) {
      return res.status(409).json({
        error: 'Este ticket ya fue calificado anteriormente',
        already_rated: true,
      });
    }

    const rating = await ratingService.createRating(
      ticketId,
      userId,
      ticket.assigned_agent_id,
      score,
      comentario
    );

    res.status(201).json(rating);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al calificar ticket: ' + error.message });
  }
};

// Obtener calificación de un ticket
export const getTicketRating = async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    const rating = await ratingService.getRatingByTicket(ticketId);
    res.json(rating ?? null);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener calificación: ' + error.message });
  }
};
