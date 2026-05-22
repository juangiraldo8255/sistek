import { authService } from './authService';

const API_URL = 'http://localhost:4000/api';

export interface Rating {
  id: number;
  ticket_id: number;
  cliente_id: number;
  agente_id: number | null;
  puntuacion: number;
  comentario: string | null;
  created_at: string;
}

export const ratingService = {
  async getRating(ticketId: number): Promise<Rating | null> {
    const response = await fetch(`${API_URL}/tickets/${ticketId}/rating`, {
      headers: authService.getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Error al obtener calificación');
    return response.json();
  },

  async rateTicket(ticketId: number, puntuacion: number, comentario?: string): Promise<Rating> {
    const response = await fetch(`${API_URL}/tickets/${ticketId}/rating`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
      body: JSON.stringify({ puntuacion, comentario }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    return response.json();
  },
};
