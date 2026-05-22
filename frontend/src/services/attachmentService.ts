import { authService } from './authService';

const API_URL  = 'http://localhost:4000/api';
const FILE_URL = 'http://localhost:4000/uploads';

export interface Attachment {
  id: number;
  ticket_id: number;
  user_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  created_at: string;
  uploader: string;
}

export const attachmentService = {
  /** URL pública del archivo (para <img src> y descarga directa) */
  getFileUrl(filename: string): string {
    return `${FILE_URL}/${filename}`;
  },

  async getAttachments(ticketId: number): Promise<Attachment[]> {
    const response = await fetch(`${API_URL}/attachments/ticket/${ticketId}`, {
      headers: authService.getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Error al cargar adjuntos');
    return response.json();
  },

  async uploadAttachment(ticketId: number, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.append('file', file);

    // Para FormData NO se incluye Content-Type (el browser lo pone con el boundary)
    const token = authService.getToken() ?? '';
    const response = await fetch(`${API_URL}/attachments/ticket/${ticketId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error ?? 'Error al subir el archivo');
    }
    return response.json();
  },

  async deleteAttachment(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/attachments/${id}`, {
      method: 'DELETE',
      headers: authService.getAuthHeaders(),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error ?? 'Error al eliminar adjunto');
    }
  },
};
