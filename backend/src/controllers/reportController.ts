import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import * as reportService from '../services/reportService';

// ── Paleta ───────────────────────────────────────────────────────────────────
const COLOR_PRIMARY  = '#6366f1';
const COLOR_DARK     = '#1e293b';
const COLOR_GRAY     = '#64748b';
const COLOR_LIGHT_BG = '#f8fafc';
const COLOR_BORDER   = '#e2e8f0';
const COLOR_RED      = '#ef4444';
const COLOR_YELLOW   = '#f59e0b';
const COLOR_GREEN    = '#10b981';
const COLOR_ORANGE   = '#f97316';
const COLOR_LIME     = '#84cc16';
const COLOR_GOLD     = '#f59e0b';

export const getReport = async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, agent_id, status } = req.query;

    if (req.userRole !== 'administrador') {
      return res.status(403).json({ error: 'Solo administradores pueden ver reportes' });
    }

    const filters: reportService.ReportFilters = {};
    if (start_date && typeof start_date === 'string') filters.start_date = start_date;
    if (end_date   && typeof end_date   === 'string') filters.end_date   = end_date;
    if (agent_id   && typeof agent_id   === 'string') filters.agent_id   = parseInt(agent_id);
    if (status     && typeof status     === 'string') filters.status     = status;

    const data = await reportService.getReportData(filters);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al generar reporte: ' + error.message });
  }
};

export const downloadReport = async (req: Request, res: Response) => {
  try {
    if (req.userRole !== 'administrador') {
      return res.status(403).json({ error: 'Solo administradores pueden descargar reportes' });
    }

    const { start_date, end_date, agent_id, status } = req.query;
    const filters: reportService.ReportFilters = {};
    if (start_date && typeof start_date === 'string') filters.start_date = start_date;
    if (end_date   && typeof end_date   === 'string') filters.end_date   = end_date;
    if (agent_id   && typeof agent_id   === 'string') filters.agent_id   = parseInt(agent_id);
    if (status     && typeof status     === 'string') filters.status     = status;

    const [reportData, tickets] = await Promise.all([
      reportService.getReportData(filters),
      reportService.getTicketsForExport(filters),
    ]);

    const now = new Date();
    const fechaGeneracion = now.toLocaleString('es-CL', { timeZone: 'America/Santiago' });
    const filtrosTexto = [
      filters.start_date ? `Desde ${filters.start_date}` : null,
      filters.end_date   ? `Hasta ${filters.end_date}`   : null,
      filters.status     ? `Estado: ${filters.status}`   : null,
      filters.agent_id   ? `Agente ID: ${filters.agent_id}` : null,
    ].filter(Boolean).join('  ·  ') || 'Sin filtros (todos los datos)';

    const { resumen, por_agente, calificaciones } = reportData;

    const doc = new PDFDocument({ margin: 45, size: 'A4' });
    const filename = `reporte_sistek_${now.toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const pageW   = doc.page.width;
    const margin  = 45;
    const contentW = pageW - margin * 2;

    // ── ENCABEZADO ────────────────────────────────────────────────────────────
    doc.rect(0, 0, pageW, 75).fill(COLOR_PRIMARY);
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold').text('Sistek', margin, 18);
    doc.fontSize(11).font('Helvetica').text('Reporte de Gestión de Tickets', margin, 42);
    doc.fillColor('white').fontSize(9)
       .text(fechaGeneracion, pageW - margin - 150, 30, { width: 150, align: 'right' });
    doc.moveDown(3.5);

    // ── FILTROS ───────────────────────────────────────────────────────────────
    doc.roundedRect(margin, doc.y, contentW, 28, 4).fill(COLOR_LIGHT_BG);
    doc.fillColor(COLOR_GRAY).fontSize(8).font('Helvetica-Bold')
       .text('FILTROS APLICADOS', margin + 10, doc.y - 22);
    doc.fillColor(COLOR_DARK).fontSize(9).font('Helvetica')
       .text(filtrosTexto, margin + 10, doc.y - 10, { width: contentW - 20 });
    doc.moveDown(1.5);

    // ── SECCIÓN: MÉTRICAS GENERALES ───────────────────────────────────────────
    sectionTitle(doc, 'Métricas Generales', margin, contentW);

    const metricas = [
      { label: 'Total',        value: String(resumen.total),        color: COLOR_PRIMARY },
      { label: 'Abiertos',     value: String(resumen.abiertos),     color: COLOR_RED    },
      { label: 'En progreso',  value: String(resumen.en_progreso),  color: COLOR_YELLOW },
      { label: 'Cerrados',     value: String(resumen.cerrados),     color: COLOR_GREEN  },
      { label: 'Alta',         value: String(resumen.alta),         color: COLOR_RED    },
      { label: 'Media',        value: String(resumen.media),        color: COLOR_YELLOW },
      { label: 'Baja',         value: String(resumen.baja),         color: COLOR_GREEN  },
      { label: 'Prom. resp.',  value: resumen.avg_respuesta_horas  != null ? `${resumen.avg_respuesta_horas} h`  : '—', color: COLOR_PRIMARY },
      { label: 'Prom. resol.', value: resumen.avg_resolucion_horas != null ? `${resumen.avg_resolucion_horas} h` : '—', color: COLOR_PRIMARY },
    ];

    drawCards(doc, metricas, margin, contentW, 9);

    // ── SECCIÓN: SATISFACCIÓN DEL CLIENTE ─────────────────────────────────────
    if (calificaciones) {
      sectionTitle(doc, 'Satisfacción del Cliente', margin, contentW);

      const { general, por_agente: calPorAgente } = calificaciones;

      // Fila 1: métricas de volumen + promedio + porcentaje
      const satCards = [
        { label: 'Tickets cerrados',  value: String(general.cerrados_total),                                                           color: COLOR_GREEN   },
        { label: 'Calificados',        value: String(general.calificados),                                                              color: COLOR_PRIMARY  },
        { label: 'Sin calificar',      value: String(general.no_calificados),                                                           color: COLOR_YELLOW  },
        { label: 'Promedio general',   value: general.promedio_general   != null ? `${general.promedio_general} ★`   : '—',             color: COLOR_GOLD    },
        { label: '% Satisfacción',     value: general.pct_satisfaccion   != null ? `${general.pct_satisfaccion}%`   : '—',             color: COLOR_GREEN   },
      ];

      drawCards(doc, satCards, margin, contentW, 5);

      // Fila 2: distribución de estrellas
      sectionSubtitle(doc, 'Distribución de calificaciones', margin);

      const distCols = [
        { header: '1 ★', width: 70 },
        { header: '2 ★', width: 70 },
        { header: '3 ★', width: 70 },
        { header: '4 ★', width: 70 },
        { header: '5 ★', width: 70 },
        { header: 'Total calificados', width: 110 },
      ];
      const distRows = [[
        String(general.estrellas_1 ?? 0),
        String(general.estrellas_2 ?? 0),
        String(general.estrellas_3 ?? 0),
        String(general.estrellas_4 ?? 0),
        String(general.estrellas_5 ?? 0),
        String(general.calificados),
      ]];
      drawTable(doc, distCols, distRows, margin, contentW);

      // Tabla por agente (con todas las columnas nuevas)
      if (calPorAgente.length > 0) {
        sectionSubtitle(doc, 'Calificación por agente', margin);

        const agCalCols = [
          { header: 'Agente',        width: 95  },
          { header: 'Total calif.',  width: 55  },
          { header: 'Promedio',      width: 60  },
          { header: '% Satisf.',     width: 55  },
          { header: '1★',            width: 30  },
          { header: '2★',            width: 30  },
          { header: '3★',            width: 30  },
          { header: '4★',            width: 30  },
          { header: '5★',            width: 30  },
        ];

        const agCalRows = calPorAgente.map((a: any) => [
          a.agente,
          String(a.total_calificaciones),
          a.promedio_calificacion != null ? `${a.promedio_calificacion} / 5` : '—',
          a.pct_satisfaccion      != null ? `${a.pct_satisfaccion}%`         : '—',
          String(a.estrellas_1 ?? 0),
          String(a.estrellas_2 ?? 0),
          String(a.estrellas_3 ?? 0),
          String(a.estrellas_4 ?? 0),
          String(a.estrellas_5 ?? 0),
        ]);

        drawTable(doc, agCalCols, agCalRows, margin, contentW);
      }
    }

    // ── SECCIÓN: DETALLE POR AGENTE (TICKETS) ────────────────────────────────
    if (por_agente.length > 0) {
      sectionTitle(doc, 'Detalle por Agente', margin, contentW);

      const agenteCols = [
        { header: 'Agente',           width: 130 },
        { header: 'Total',            width: 50  },
        { header: 'Abiertos',         width: 60  },
        { header: 'En progreso',      width: 75  },
        { header: 'Cerrados',         width: 65  },
        { header: 'Prom. resolución', width: 100 },
      ];

      const agentRows = por_agente.map(a => [
        a.agente,
        String(a.total),
        String(a.abiertos),
        String(a.en_progreso),
        String(a.cerrados),
        a.avg_resolucion_horas != null ? `${a.avg_resolucion_horas} h` : '—',
      ]);

      drawTable(doc, agenteCols, agentRows, margin, contentW);
    }

    // ── SECCIÓN: LISTADO DE TICKETS ───────────────────────────────────────────
    sectionTitle(doc, 'Listado de Tickets', margin, contentW);

    if (tickets.length === 0) {
      doc.fillColor(COLOR_GRAY).fontSize(10).font('Helvetica')
         .text('No hay tickets con los filtros seleccionados.', margin, doc.y);
    } else {
      const ticketCols = [
        { header: 'ID',          width: 28  },
        { header: 'Título',      width: 110 },
        { header: 'Estado',      width: 65  },
        { header: 'Prioridad',   width: 52  },
        { header: 'Agente',      width: 80  },
        { header: 'Creado por',  width: 72  },
        { header: 'Resolución',  width: 52  },
        { header: 'Calif.',      width: 36  },
      ];

      const ticketRows = tickets.map(t => [
        String(t.id),
        t.title,
        t.status,
        t.priority,
        t.agente_asignado ?? 'Sin asignar',
        t.creado_por,
        t.resolucion_horas    != null ? `${t.resolucion_horas} h`  : '—',
        t.calificacion        != null ? `${t.calificacion} ★`      : '—',
      ]);

      drawTable(doc, ticketCols, ticketRows, margin, contentW);
    }

    // ── PIE DE PÁGINA ─────────────────────────────────────────────────────────
    doc.fontSize(8).fillColor(COLOR_GRAY).font('Helvetica')
       .text(
         `Generado por Sistek  ·  ${fechaGeneracion}  ·  ${tickets.length} ticket(s)`,
         margin, doc.page.height - 35,
         { width: contentW, align: 'center' }
       );

    doc.end();
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al generar descarga: ' + error.message });
    }
  }
};

// ── HELPERS ──────────────────────────────────────────────────────────────────

function sectionTitle(doc: PDFKit.PDFDocument, title: string, margin: number, contentW: number) {
  doc.moveDown(0.4);
  const y = doc.y;
  doc.rect(margin, y, contentW, 22).fill(COLOR_PRIMARY);
  doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
     .text(title.toUpperCase(), margin + 10, y + 6);
  doc.y = y + 30;
}

function sectionSubtitle(doc: PDFKit.PDFDocument, title: string, margin: number) {
  doc.moveDown(0.3);
  doc.fillColor(COLOR_GRAY).fontSize(8).font('Helvetica-Bold')
     .text(title.toUpperCase(), margin, doc.y);
  doc.moveDown(0.4);
}

function drawCards(
  doc: PDFKit.PDFDocument,
  cards: { label: string; value: string; color: string }[],
  margin: number,
  contentW: number,
  count: number,
) {
  const gap    = 6;
  const cardW  = Math.floor((contentW - gap * (count - 1)) / count);
  const cardH  = 52;
  let cx       = margin;
  const cy     = doc.y;

  cards.forEach(m => {
    doc.roundedRect(cx, cy, cardW, cardH, 4).fill(COLOR_LIGHT_BG);
    doc.rect(cx, cy, 3, cardH).fill(m.color);
    doc.fillColor(COLOR_GRAY).fontSize(7).font('Helvetica')
       .text(m.label.toUpperCase(), cx + 6, cy + 7, { width: cardW - 8 });
    doc.fillColor(m.color).fontSize(14).font('Helvetica-Bold')
       .text(m.value, cx + 6, cy + 20, { width: cardW - 8 });
    cx += cardW + gap;
  });

  doc.y = cy + cardH + 16;
}

function drawTable(
  doc: PDFKit.PDFDocument,
  cols: { header: string; width: number }[],
  rows: string[][],
  margin: number,
  contentW: number,
) {
  const rowH    = 18;
  const headerH = 20;
  let y = doc.y;

  doc.rect(margin, y, contentW, headerH).fill('#e2e8f0');
  let x = margin;
  cols.forEach(col => {
    doc.fillColor(COLOR_DARK).fontSize(8).font('Helvetica-Bold')
       .text(col.header, x + 4, y + 6, { width: col.width - 8, ellipsis: true });
    x += col.width;
  });
  y += headerH;

  rows.forEach((row, ri) => {
    if (y + rowH > doc.page.height - 60) {
      doc.addPage();
      y = 45;
    }

    if (ri % 2 === 1) {
      doc.rect(margin, y, contentW, rowH).fill(COLOR_LIGHT_BG);
    }

    x = margin;
    row.forEach((cell, ci) => {
      const colW = cols[ci]?.width ?? 80;
      let textColor = COLOR_DARK;
      if (cell === 'Abierto')     textColor = COLOR_RED;
      if (cell === 'En progreso') textColor = COLOR_YELLOW;
      if (cell === 'Cerrado')     textColor = COLOR_GREEN;
      if (cell === 'Alta')        textColor = COLOR_RED;
      if (cell === 'Media')       textColor = COLOR_YELLOW;
      if (cell === 'Baja')        textColor = COLOR_GREEN;
      if (cell?.includes('★'))    textColor = COLOR_GOLD;

      doc.fillColor(textColor).fontSize(8).font('Helvetica')
         .text(cell ?? '—', x + 4, y + 5, { width: colW - 8, ellipsis: true });
      x += colW;
    });

    doc.moveTo(margin, y + rowH).lineTo(margin + contentW, y + rowH)
       .strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
    y += rowH;
  });

  doc.y = y + 10;
}
