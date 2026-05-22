import { Request, Response } from 'express';
import * as ticketService from '../services/ticketService';
import * as userService from '../services/userService';
import { VALID_PRIORITIES } from '../services/ticketService';

// Crear ticket (HU-3)
export const createTicket = async (req: Request, res: Response) => {
  try {
    const { title, description, type } = req.body;
    const userId = req.userId!;
    const userRole = req.userRole!;

    if (!title || !description || !type) {
      return res.status(400).json({
        error: 'Campos requeridos: title, description, type'
      });
    }

    // Validar que el usuario es cliente
    if (userRole !== 'cliente') {
      return res.status(403).json({ error: 'Solo los clientes pueden crear tickets' });
    }

    // La prioridad la asigna el sistema; el cliente no puede elegirla
    const priority = 'Media';
    const newTicket = await ticketService.createTicket(title, description, priority, type, userId);
    res.status(201).json(newTicket);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al crear ticket: ' + error.message });
  }
};

// Obtener todos los tickets (HU-4 - Admin)
export const getAllTickets = async (req: Request, res: Response) => {
  try {
    const userRole = req.userRole!;

    if (userRole !== 'administrador') {
      return res.status(403).json({ error: 'Solo administradores pueden ver todos los tickets' });
    }

    const tickets = await ticketService.getAllTickets();
    res.json(tickets);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener tickets: ' + error.message });
  }
};

// Obtener tickets del usuario autenticado (HU-4)
export const getMyTickets = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const userRole = req.userRole!;

    let tickets;
    
    if (userRole === 'cliente') {
      // Cliente solo ve sus tickets
      tickets = await ticketService.getUserTickets(userId);
    } else if (userRole === 'agente') {
      // Agente solo ve sus tickets asignados
      tickets = await ticketService.getAgentTickets(userId);
    } else if (userRole === 'administrador') {
      // Admin ve todos
      tickets = await ticketService.getAllTickets();
    } else {
      return res.status(403).json({ error: 'Rol no reconocido' });
    }

    res.json(tickets);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener tickets: ' + error.message });
  }
};

// Obtener un ticket por ID
export const getTicketById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ticket = await ticketService.getTicketById(parseInt(id));

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    res.json(ticket);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener ticket: ' + error.message });
  }
};

// Cambiar estado de un ticket (HU-6)
export const updateTicketStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.userId!;
    const userRole = req.userRole!;

    if (!status) {
      return res.status(400).json({ error: 'Status es requerido' });
    }

    const ticket = await ticketService.getTicketById(parseInt(id));
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    // Validar permisos (HU-6: solo agente asignado o admin)
    if (userRole !== 'administrador' && ticket.assigned_agent_id !== userId) {
      return res.status(403).json({ error: 'No tienes permisos para cambiar el estado de este ticket' });
    }

    const updatedTicket = await ticketService.updateTicketStatus(parseInt(id), status, userId);
    res.json(updatedTicket);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// Asignar ticket a un agente (HU-5)
export const assignTicketToAgent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;
    const userId = req.userId!;
    const userRole = req.userRole!;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId es requerido' });
    }

    // Validar que solo administrador puede asignar (HU-5)
    if (userRole !== 'administrador') {
      return res.status(403).json({ error: 'Solo administradores pueden asignar tickets' });
    }

    const ticket = await ticketService.getTicketById(parseInt(id));
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    const updatedTicket = await ticketService.assignTicketToAgent(parseInt(id), agentId, userId);
    res.json(updatedTicket);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener historial de un ticket (HU-7)
export const getTicketHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const userRole = req.userRole!;

    const ticket = await ticketService.getTicketById(parseInt(id));
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    // Validar permisos de visualización
    if (userRole === 'cliente' && ticket.user_id !== userId) {
      return res.status(403).json({ error: 'No puedes ver el historial de este ticket' });
    } else if (userRole === 'agente' && ticket.assigned_agent_id !== userId && userRole !== 'administrador') {
      return res.status(403).json({ error: 'No puedes ver el historial de este ticket' });
    }

    const history = await ticketService.getTicketHistory(parseInt(id));
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener historial: ' + error.message });
  }
};

// Actualizar prioridad de un ticket (HU prioridad)
export const updateTicketPriority = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;
    const userId = req.userId!;
    const userRole = req.userRole!;

    if (!priority) {
      return res.status(400).json({
        error: `priority es requerido. Valores permitidos: ${VALID_PRIORITIES.join(', ')}`
      });
    }

    if (!VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        error: `Prioridad inválida. Valores permitidos: ${VALID_PRIORITIES.join(', ')}`
      });
    }

    const ticket = await ticketService.getTicketById(parseInt(id));
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    if (userRole !== 'administrador' && ticket.assigned_agent_id !== userId) {
      return res.status(403).json({ error: 'Solo puedes modificar tickets asignados a ti' });
    }

    const updatedTicket = await ticketService.updateTicketPriority(parseInt(id), priority, userId);
    res.json(updatedTicket);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// Buscar tickets por palabra clave (título o descripción)
export const searchTickets = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    const userId = req.userId!;
    const userRole = req.userRole!;

    if (!q || typeof q !== 'string' || !q.trim()) {
      let tickets;
      if (userRole === 'cliente') {
        tickets = await ticketService.getUserTickets(userId);
      } else if (userRole === 'agente') {
        tickets = await ticketService.getAgentTickets(userId);
      } else {
        tickets = await ticketService.getAllTickets();
      }
      return res.json(tickets);
    }

    const tickets = await ticketService.searchTickets(q.trim(), userId, userRole);
    res.json(tickets);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al buscar tickets: ' + error.message });
  }
};

// Reabrir ticket (HU-019)
export const reopenTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const userId = req.userId!;
    const userRole = req.userRole!;

    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ error: 'El motivo de reapertura es obligatorio' });
    }

    const updatedTicket = await ticketService.reopenTicket(
      parseInt(id),
      userId,
      userRole,
      motivo.trim()
    );
    res.json(updatedTicket);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar ticket
export const deleteTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.userRole!;

    if (userRole !== 'administrador') {
      return res.status(403).json({ error: 'Solo administradores pueden eliminar tickets' });
    }

    const ticket = await ticketService.deleteTicket(parseInt(id));
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    res.json({ message: 'Ticket eliminado' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al eliminar ticket: ' + error.message });
  }
};
