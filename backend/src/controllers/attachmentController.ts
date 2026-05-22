import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import pool from '../config/database';
import * as attachmentService from '../services/attachmentService';
import { UPLOAD_DIR } from '../middleware/upload';

// POST /api/attachments/ticket/:ticketId
export const uploadAttachment = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }

    const ticketId = parseInt(req.params.ticketId);
    const userId   = req.userId!;

    const ticketCheck = await pool.query('SELECT id FROM tickets WHERE id = $1', [ticketId]);
    if (ticketCheck.rows.length === 0) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }

    const attachment = await attachmentService.createAttachment(
      ticketId,
      userId,
      req.file.filename,
      req.file.originalname,
      req.file.mimetype,
      req.file.size
    );

    // Registrar en historial
    await pool.query(
      `INSERT INTO ticket_historia
         (ticket_id, usuario_accion_id, tipo_accion, valor_anterior, valor_nuevo)
       VALUES ($1, $2, 'attachment_upload', NULL, $3)`,
      [ticketId, userId, req.file.originalname]
    );

    res.status(201).json(attachment);
  } catch (error: any) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Error al subir archivo: ' + error.message });
  }
};

// GET /api/attachments/ticket/:ticketId
export const getAttachments = async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    const attachments = await attachmentService.getAttachmentsByTicket(ticketId);
    res.json(attachments);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener adjuntos: ' + error.message });
  }
};

// GET /api/attachments/:id/file
export const serveFile = async (req: Request, res: Response) => {
  try {
    const attachment = await attachmentService.getAttachmentById(parseInt(req.params.id));
    if (!attachment) return res.status(404).json({ error: 'Adjunto no encontrado.' });

    const filePath = path.join(UPLOAD_DIR, attachment.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado en el servidor.' });
    }

    res.setHeader('Content-Disposition', `inline; filename="${attachment.original_name}"`);
    res.setHeader('Content-Type', attachment.mime_type);
    res.sendFile(filePath);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al servir archivo: ' + error.message });
  }
};

// DELETE /api/attachments/:id
export const deleteAttachment = async (req: Request, res: Response) => {
  try {
    const attachmentId = parseInt(req.params.id);
    const userId   = req.userId!;
    const userRole = req.userRole!;

    const attachment = await attachmentService.getAttachmentById(attachmentId);
    if (!attachment) return res.status(404).json({ error: 'Adjunto no encontrado.' });

    if (attachment.user_id !== userId && userRole !== 'administrador') {
      return res.status(403).json({ error: 'Solo puedes eliminar tus propios adjuntos.' });
    }

    await attachmentService.deleteAttachmentRecord(attachmentId);

    const filePath = path.join(UPLOAD_DIR, attachment.filename);
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});

    // Registrar en historial
    await pool.query(
      `INSERT INTO ticket_historia
         (ticket_id, usuario_accion_id, tipo_accion, valor_anterior, valor_nuevo)
       VALUES ($1, $2, 'attachment_delete', $3, NULL)`,
      [attachment.ticket_id, userId, attachment.original_name]
    );

    res.json({ message: 'Adjunto eliminado.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al eliminar adjunto: ' + error.message });
  }
};
