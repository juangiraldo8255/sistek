import { authService } from './authService';

const API_URL = 'http://localhost:4000/api';

export const PRIORIDADES = ['Alta', 'Media', 'Baja'] as const;
export type PrioridadTicket = typeof PRIORIDADES[number];

export const PRIORIDAD_ORDEN: Record<string, number> = { Alta: 1, Media: 2, Baja: 3 };

export interface Ticket {
  id: number;
  title: string;
  description: string;
  priority: string;
  type: string;
  status: 'Abierto' | 'En progreso' | 'Cerrado';
  user_id: number;
  assigned_agent_id: number | null;
  assigned_date: string | null;
  creator?: string;
  assigned_agent?: string;
  created_at: string;
  updated_at: string;
}

export interface TicketHistory {
  id: number;
  ticket_id: number;
  usuario_accion_id: number;
  nombre_usuario?: string;
  tipo_accion: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  fecha_registro: string;
}

export const ticketService = {
  // Crear ticket (HU-3)
  async createTicket(
    title: string,
    description: string,
    priority: string,
    type: string
  ): Promise<Ticket> {
    const response = await fetch(`${API_URL}/tickets`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
      body: JSON.stringify({ title, description, priority, type })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    
    return response.json();
  },

  // Obtener mis tickets (HU-4)
  async getMyTickets(): Promise<Ticket[]> {
    const response = await fetch(`${API_URL}/tickets`, {
      headers: authService.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error fetching tickets');
    return response.json();
  },

  // Obtener todos los tickets (HU-4 - solo admin)
  async getAllTickets(): Promise<Ticket[]> {
    const response = await fetch(`${API_URL}/tickets/all`, {
      headers: authService.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error fetching tickets');
    return response.json();
  },

  // Obtener un ticket por ID
  async getTicket(id: number): Promise<Ticket> {
    const response = await fetch(`${API_URL}/tickets/${id}`, {
      headers: authService.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Ticket not found');
    return response.json();
  },

  // Cambiar estado del ticket (HU-6)
  async updateTicketStatus(id: number, status: 'Abierto' | 'En progreso' | 'Cerrado', changedBy: number): Promise<Ticket> {
    const response = await fetch(`${API_URL}/tickets/${id}/status`, {
      method: 'PUT',
      headers: authService.getAuthHeaders(),
      body: JSON.stringify({ status, changedBy })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    return response.json();
  },

  // Asignar ticket a agente (HU-5)
  async assignTicketToAgent(id: number, agentId: number): Promise<Ticket> {
    const response = await fetch(`${API_URL}/tickets/${id}/assign`, {
      method: 'PUT',
      headers: authService.getAuthHeaders(),
      body: JSON.stringify({ agentId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    return response.json();
  },

  // Obtener historial del ticket (HU-7)
  async getTicketHistory(id: number): Promise<TicketHistory[]> {
    const response = await fetch(`${API_URL}/tickets/${id}/history`, {
      headers: authService.getAuthHeaders()
    });
    
    if (!response.ok) throw new Error('Error fetching ticket history');
    return response.json();
  },

  // Actualizar prioridad de un ticket (HU prioridad)
  async updateTicketPriority(id: number, priority: PrioridadTicket): Promise<Ticket> {
    const response = await fetch(`${API_URL}/tickets/${id}/priority`, {
      method: 'PUT',
      headers: authService.getAuthHeaders(),
      body: JSON.stringify({ priority })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    return response.json();
  },

  // Buscar tickets por palabra clave en título o descripción
  async searchTickets(query: string): Promise<Ticket[]> {
    const url = query.trim()
      ? `${API_URL}/tickets/search?q=${encodeURIComponent(query.trim())}`
      : `${API_URL}/tickets/search`;
    const response = await fetch(url, {
      headers: authService.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error al buscar tickets');
    return response.json();
  },

  // Reabrir ticket (HU-019)
  async reopenTicket(id: number, motivo: string): Promise<Ticket> {
    const response = await fetch(`${API_URL}/tickets/${id}/reopen`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
      body: JSON.stringify({ motivo })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    return response.json();
  },

  // Eliminar ticket (solo admin)
  async deleteTicket(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/tickets/${id}`, {
      method: 'DELETE',
      headers: authService.getAuthHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
  }
};
