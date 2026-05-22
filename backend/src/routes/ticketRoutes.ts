import { Router } from 'express';
import * as ticketController from '../controllers/ticketController';
import * as commentController from '../controllers/commentController';
import * as ratingController from '../controllers/ratingController';
import { authMiddleware, adminOnly, clientOnly, agentOnly } from '../middlewares/authMiddleware';

const router = Router();

// Todas las rutas de tickets requieren autenticación
router.use(authMiddleware);

// Crear ticket (HU-3) - solo clientes
router.post('/', clientOnly, ticketController.createTicket);

// Obtener tickets (HU-4)
router.get('/', ticketController.getMyTickets);
router.get('/all', adminOnly, ticketController.getAllTickets);
router.get('/search', ticketController.searchTickets);
router.get('/:id', ticketController.getTicketById);

// Cambiar estado de ticket (HU-6) - agente o admin
router.put('/:id/status', agentOnly, ticketController.updateTicketStatus);

// Asignar ticket a agente (HU-5) - solo admin
router.put('/:id/assign', adminOnly, ticketController.assignTicketToAgent);

// Actualizar prioridad (HU prioridad) - agente o admin
router.put('/:id/priority', agentOnly, ticketController.updateTicketPriority);

// Obtener historial (HU-7)
router.get('/:id/history', ticketController.getTicketHistory);

// Reabrir ticket (HU-019) - cliente y agente
router.post('/:id/reopen', ticketController.reopenTicket);

// Eliminar ticket - solo admin
router.delete('/:id', adminOnly, ticketController.deleteTicket);

// Comentarios de un ticket
router.get('/:id/comments', commentController.getComments);
router.post('/:id/comments', commentController.createComment);

// Calificación de un ticket (HU-021)
router.get('/:id/rating', ratingController.getTicketRating);
router.post('/:id/rating', clientOnly, ratingController.rateTicket);

export default router;
