import { authService } from './authService';

const API_URL = 'http://localhost:4000/api';

export interface ReportFilters {
  start_date?: string;
  end_date?: string;
  agent_id?: string;
  status?: string;
}

export interface ReportResumen {
  total: number;
  abiertos: number;
  en_progreso: number;
  cerrados: number;
  alta: number;
  media: number;
  baja: number;
  avg_resolucion_horas: string | null;
  avg_respuesta_horas: string | null;
}

export interface ReportAgente {
  agente: string;
  total: number;
  cerrados: number;
  abiertos: number;
  en_progreso: number;
  avg_resolucion_horas: string | null;
}

export interface RatingAgente {
  agente_id: number;
  agente: string;
  total_calificaciones: number;
  promedio_calificacion: string | null;
  pct_satisfaccion: string | null;
  estrellas_1: number;
  estrellas_2: number;
  estrellas_3: number;
  estrellas_4: number;
  estrellas_5: number;
}

export interface RatingGeneral {
  cerrados_total: number;
  calificados: number;
  no_calificados: number;
  promedio_general: string | null;
  pct_satisfaccion: string | null;
  estrellas_1: number;
  estrellas_2: number;
  estrellas_3: number;
  estrellas_4: number;
  estrellas_5: number;
}

export interface CalificacionesData {
  general: RatingGeneral;
  por_agente: RatingAgente[];
}

export interface ReportData {
  resumen: ReportResumen;
  por_agente: ReportAgente[];
  calificaciones: CalificacionesData;
}

export const reportService = {
  async getReport(filters: ReportFilters = {}): Promise<ReportData> {
    const params = new URLSearchParams();
    if (filters.start_date) params.set('start_date', filters.start_date);
    if (filters.end_date)   params.set('end_date',   filters.end_date);
    if (filters.agent_id)   params.set('agent_id',   filters.agent_id);
    if (filters.status)     params.set('status',     filters.status);

    const url = `${API_URL}/reports${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url, { headers: authService.getAuthHeaders() });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    return response.json();
  },

  async downloadReport(filters: ReportFilters = {}): Promise<void> {
    const params = new URLSearchParams();
    if (filters.start_date) params.set('start_date', filters.start_date);
    if (filters.end_date)   params.set('end_date',   filters.end_date);
    if (filters.agent_id)   params.set('agent_id',   filters.agent_id);
    if (filters.status)     params.set('status',     filters.status);

    const url = `${API_URL}/reports/download${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url, { headers: authService.getAuthHeaders() });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : 'reporte_sistek.pdf';

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  },
};
