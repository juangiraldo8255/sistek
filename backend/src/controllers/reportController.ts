import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import * as reportService from '../services/reportService';

// ── Paleta ───────────────────────────────────────────────────────────────────
const COLOR_PRIMARY   = '#2563eb';
const COLOR_PRIMARY2  = '#1d4ed8';
const COLOR_ACCENT    = '#6366f1';
const COLOR_DARK      = '#1e293b';
const COLOR_GRAY      = '#64748b';
const COLOR_LIGHT_BG  = '#f8fafc';
const COLOR_WHITE     = '#ffffff';
const COLOR_BORDER    = '#e2e8f0';
const COLOR_RED       = '#ef4444';
const COLOR_RED_BG    = '#fee2e2';
const COLOR_YELLOW    = '#f59e0b';
const COLOR_YELLOW_BG = '#fef3c7';
const COLOR_GREEN     = '#10b981';
const COLOR_GREEN_BG  = '#dcfce7';
const COLOR_ORANGE    = '#f97316';
const COLOR_LIME      = '#84cc16';
const COLOR_GOLD      = '#f59e0b';
const COLOR_PURPLE    = '#8b5cf6';

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

    const doc = new PDFDocument({ margin: 45, size: 'A4', autoFirstPage: true });
    const filename = `reporte_sistek_${now.toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const pageW    = doc.page.width;
    const pageH    = doc.page.height;
    const margin   = 45;
    const contentW = pageW - margin * 2;

    const drawFooter = () => {
      const savedY = doc.y;           // guardar posición actual
      const fy     = pageH - 38;
      doc.rect(margin, fy - 6, contentW, 0.5).fill(COLOR_BORDER);
      // lineBreak: false evita que doc.y avance y genere una página extra
      doc.fillColor(COLOR_GRAY).fontSize(7.5).font('Helvetica')
         .text('SISTEK — Sistema de Gestion de Tickets',
               margin, fy, { width: contentW / 2, lineBreak: false });
      doc.fillColor(COLOR_GRAY).fontSize(7.5).font('Helvetica')
         .text(`Generado: ${fechaGeneracion}  |  ${tickets.length} ticket(s)`,
               margin + contentW / 2, fy,
               { width: contentW / 2, align: 'right', lineBreak: false });
      doc.y = savedY;                 // restaurar posición para no desbordarse
    };

    // ── ENCABEZADO ────────────────────────────────────────────────────────────
    const headerH = 95;
    doc.rect(0, 0, pageW, headerH).fill(COLOR_PRIMARY);
    doc.rect(0, headerH - 5, pageW, 5).fill(COLOR_PRIMARY2);
    // Círculos decorativos
    doc.save();
    doc.fillOpacity(0.08).circle(pageW - 40, 8, 80).fill(COLOR_WHITE);
    doc.fillOpacity(0.06).circle(pageW - 5, headerH, 55).fill(COLOR_WHITE);
    doc.restore();

    doc.fillColor(COLOR_WHITE).fontSize(26).font('Helvetica-Bold')
       .text('SISTEK', margin, 18, { characterSpacing: 2 });
    doc.fillColor(COLOR_WHITE).fontSize(11).font('Helvetica')
       .text('Reporte de Gestion de Tickets', margin, 50);
    doc.fillColor(COLOR_WHITE).fontSize(9).font('Helvetica-Bold')
       .text(fechaGeneracion, margin, 22, { width: contentW, align: 'right' });
    doc.fillColor(COLOR_WHITE).fontSize(8).font('Helvetica')
       .text(`${tickets.length} ticket(s) en este reporte`, margin, 38, { width: contentW, align: 'right' });

    doc.y = headerH + 18;

    // ── FILTROS ───────────────────────────────────────────────────────────────
    const fy0 = doc.y;
    doc.roundedRect(margin, fy0, contentW, 32, 6).fill('#eef2ff');
    doc.rect(margin, fy0, 4, 32).fill(COLOR_ACCENT);
    doc.fillColor(COLOR_ACCENT).fontSize(7.5).font('Helvetica-Bold')
       .text('FILTROS APLICADOS', margin + 12, fy0 + 7, { characterSpacing: 0.5 });
    doc.fillColor(COLOR_DARK).fontSize(9).font('Helvetica')
       .text(filtrosTexto, margin + 12, fy0 + 19, { width: contentW - 20 });
    doc.y = fy0 + 32 + 18;

    // ── SECCIÓN: MÉTRICAS GENERALES ───────────────────────────────────────────
    sectionTitle(doc, 'Metricas Generales', margin, contentW);

    const metricas = [
      { label: 'Total',        value: String(resumen.total),        color: COLOR_ACCENT  },
      { label: 'Abiertos',     value: String(resumen.abiertos),     color: COLOR_RED     },
      { label: 'En progreso',  value: String(resumen.en_progreso),  color: COLOR_YELLOW  },
      { label: 'Cerrados',     value: String(resumen.cerrados),     color: COLOR_GREEN   },
      { label: 'Alta',         value: String(resumen.alta),         color: COLOR_RED     },
      { label: 'Media',        value: String(resumen.media),        color: COLOR_YELLOW  },
      { label: 'Baja',         value: String(resumen.baja),         color: COLOR_GREEN   },
      { label: 'Prom. resp.',  value: resumen.avg_respuesta_horas  != null ? `${resumen.avg_respuesta_horas} h`  : '--', color: COLOR_PRIMARY },
      { label: 'Prom. resol.', value: resumen.avg_resolucion_horas != null ? `${resumen.avg_resolucion_horas} h` : '--', color: COLOR_PURPLE  },
    ];

    drawCards(doc, metricas, margin, contentW, 9);

    // ── SECCIÓN: SATISFACCIÓN DEL CLIENTE ─────────────────────────────────────
    if (calificaciones) {
      sectionTitle(doc, 'Satisfaccion del Cliente', margin, contentW);

      const { general, por_agente: calPorAgente } = calificaciones;

      // Fila 1: métricas de volumen + promedio + porcentaje
      const satCards = [
        { label: 'Tickets cerrados', value: String(general.cerrados_total),                                              color: COLOR_GREEN  },
        { label: 'Calificados',      value: String(general.calificados),                                                color: COLOR_PRIMARY },
        { label: 'Sin calificar',    value: String(general.no_calificados),                                             color: COLOR_YELLOW },
        { label: 'Promedio general', value: general.promedio_general != null ? `${general.promedio_general} *` : '--', color: COLOR_GOLD   },
        { label: '% Satisfaccion',   value: general.pct_satisfaccion != null ? `${general.pct_satisfaccion}%` : '--', color: COLOR_GREEN  },
      ];

      drawCards(doc, satCards, margin, contentW, 5);

      // Fila 2: distribución de estrellas
      sectionSubtitle(doc, 'Distribucion de calificaciones', margin);

      const distCols = [
        { header: '1 *', width: 70 },
        { header: '2 *', width: 70 },
        { header: '3 *', width: 70 },
        { header: '4 *', width: 70 },
        { header: '5 *', width: 70 },
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
        sectionSubtitle(doc, 'Calificacion por agente', margin);

        const agCalCols = [
          { header: 'Agente',       width: 95 },
          { header: 'Total calif.', width: 55 },
          { header: 'Promedio',     width: 60 },
          { header: '% Satisf.',    width: 55 },
          { header: '1*', width: 30 },
          { header: '2*', width: 30 },
          { header: '3*', width: 30 },
          { header: '4*', width: 30 },
          { header: '5*', width: 30 },
        ];

        const agCalRows = calPorAgente.map((a: any) => [
          a.agente,
          String(a.total_calificaciones),
          a.promedio_calificacion != null ? `${a.promedio_calificacion} / 5` : '--',
          a.pct_satisfaccion      != null ? `${a.pct_satisfaccion}%`         : '--',
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
        { header: 'Prom. resolucion', width: 100 },
      ];

      const agentRows = por_agente.map(a => [
        a.agente,
        String(a.total),
        String(a.abiertos),
        String(a.en_progreso),
        String(a.cerrados),
        a.avg_resolucion_horas != null ? `${a.avg_resolucion_horas} h` : '--',
      ]);

      drawTable(doc, agenteCols, agentRows, margin, contentW);
    }

    // ── SECCIÓN: LISTADO DE TICKETS ───────────────────────────────────────────
    sectionTitle(doc, 'Listado de Tickets', margin, contentW);

    if (tickets.length === 0) {
      const emptyY = doc.y;
      doc.roundedRect(margin, emptyY, contentW, 36, 6).fill(COLOR_LIGHT_BG);
      doc.fillColor(COLOR_GRAY).fontSize(10).font('Helvetica')
         .text('No hay tickets con los filtros seleccionados.', margin, emptyY + 12, { width: contentW, align: 'center' });
      doc.y = emptyY + 52;
    } else {
      const ticketCols = [
        { header: 'ID',         width: 28  },
        { header: 'Titulo',     width: 110 },
        { header: 'Estado',     width: 65  },
        { header: 'Prioridad',  width: 52  },
        { header: 'Agente',     width: 80  },
        { header: 'Creado por', width: 72  },
        { header: 'Resolucion', width: 52  },
        { header: 'Calif.',     width: 36  },
      ];

      const ticketRows = tickets.map(t => [
        String(t.id),
        t.title,
        t.status,
        t.priority,
        t.agente_asignado ?? 'Sin asignar',
        t.creado_por,
        t.resolucion_horas != null ? `${t.resolucion_horas} h` : '--',
        t.calificacion     != null ? `${t.calificacion} *`     : '--',
      ]);

      drawTable(doc, ticketCols, ticketRows, margin, contentW);
    }

    // ── PIE DE PÁGINA (última página) ─────────────────────────────────────────
    drawFooter();

    doc.end();
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al generar descarga: ' + error.message });
    }
  }
};

// ── HELPERS ──────────────────────────────────────────────────────────────────

// Garantiza espacio mínimo en la página; si no hay, abre una nueva.
function ensureSpace(doc: PDFKit.PDFDocument, needed: number, margin: number) {
  if (doc.y + needed > doc.page.height - 60) {
    doc.addPage();
    doc.y = margin;
  }
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, margin: number, contentW: number) {
  ensureSpace(doc, 50, margin);
  doc.y += 10; // separación sin usar moveDown (que puede desbordarse)
  const y = doc.y;
  doc.roundedRect(margin, y, contentW, 24, 4).fill('#dbeafe');
  doc.rect(margin, y, 5, 24).fill(COLOR_PRIMARY);
  doc.fillColor(COLOR_PRIMARY).fontSize(10).font('Helvetica-Bold')
     .text(title.toUpperCase(), margin + 14, y + 7, { characterSpacing: 0.5 });
  doc.y = y + 32; // posición exacta sin moveDown
}

function sectionSubtitle(doc: PDFKit.PDFDocument, title: string, margin: number) {
  ensureSpace(doc, 30, margin);
  doc.y += 8;
  const y = doc.y;
  doc.rect(margin, y, 3, 14).fill(COLOR_ACCENT);
  doc.fillColor(COLOR_GRAY).fontSize(8).font('Helvetica-Bold')
     .text(title.toUpperCase(), margin + 8, y + 3, { characterSpacing: 0.3 });
  doc.y = y + 20; // posición exacta sin moveDown
}

function drawCards(
  doc: PDFKit.PDFDocument,
  cards: { label: string; value: string; color: string }[],
  margin: number,
  contentW: number,
  count: number,
) {
  const gap   = 8;
  const cardW = Math.floor((contentW - gap * (count - 1)) / count);
  const cardH = 58;

  ensureSpace(doc, cardH + 20, margin);

  let cx   = margin;
  const cy = doc.y;

  cards.forEach(m => {
    doc.roundedRect(cx, cy, cardW, cardH, 5).fill(COLOR_WHITE);
    doc.roundedRect(cx, cy, cardW, cardH, 5).stroke(COLOR_BORDER).lineWidth(0.5);
    doc.roundedRect(cx, cy, cardW, 4, 2).fill(m.color);
    doc.fillColor(COLOR_GRAY).fontSize(6.5).font('Helvetica')
       .text(m.label.toUpperCase(), cx + 6, cy + 10, { width: cardW - 12, characterSpacing: 0.3 });
    doc.fillColor(m.color).fontSize(15).font('Helvetica-Bold')
       .text(m.value, cx + 6, cy + 24, { width: cardW - 12 });
    cx += cardW + gap;
  });

  doc.y = cy + cardH + 14; // posición exacta
}

function drawTable(
  doc: PDFKit.PDFDocument,
  cols: { header: string; width: number }[],
  rows: string[][],
  margin: number,
  contentW: number,
) {
  const rowH    = 20;
  const headerH  = 22;
  const safeBottom = doc.page.height - 55; // margen seguro inferior
  let y = doc.y;

  const drawHeader = (atY: number) => {
    doc.roundedRect(margin, atY, contentW, headerH, 4).fill(COLOR_PRIMARY);
    let xh = margin;
    cols.forEach(col => {
      doc.fillColor(COLOR_WHITE).fontSize(7.5).font('Helvetica-Bold')
         .text(col.header.toUpperCase(), xh + 5, atY + 7,
               { width: col.width - 10, ellipsis: true, characterSpacing: 0.2 });
      xh += col.width;
    });
  };

  drawHeader(y);
  y += headerH;

  rows.forEach((row, ri) => {
    // Salto de página limpio — sin text() que avance doc.y
    if (y + rowH > safeBottom) {
      doc.addPage();
      y = margin;
      drawHeader(y);
      y += headerH;
    }

    // Fila alternada
    if (ri % 2 === 1) {
      doc.rect(margin, y, contentW, rowH).fill('#f0f4ff');
    }

    let x = margin;
    row.forEach((cell, ci) => {
      const colW    = cols[ci]?.width ?? 80;
      const cellVal = cell ?? '--';
      const badges  = ['Abierto', 'En progreso', 'Cerrado', 'Alta', 'Media', 'Baja'];

      if (badges.includes(cellVal)) {
        let bg = '#f1f5f9'; let fg = COLOR_DARK;
        if (cellVal === 'Abierto')     { bg = COLOR_RED_BG;    fg = COLOR_RED;    }
        if (cellVal === 'En progreso') { bg = COLOR_YELLOW_BG; fg = COLOR_YELLOW; }
        if (cellVal === 'Cerrado')     { bg = COLOR_GREEN_BG;  fg = COLOR_GREEN;  }
        if (cellVal === 'Alta')        { bg = COLOR_RED_BG;    fg = COLOR_RED;    }
        if (cellVal === 'Media')       { bg = COLOR_YELLOW_BG; fg = COLOR_YELLOW; }
        if (cellVal === 'Baja')        { bg = COLOR_GREEN_BG;  fg = COLOR_GREEN;  }
        doc.roundedRect(x + 3, y + 4, colW - 6, rowH - 8, 3).fill(bg);
        doc.fillColor(fg).fontSize(7.5).font('Helvetica-Bold')
           .text(cellVal, x + 5, y + 7, { width: colW - 10, ellipsis: true });
      } else {
        const textColor = cellVal.includes('*') ? COLOR_GOLD : COLOR_DARK;
        doc.fillColor(textColor).fontSize(8).font('Helvetica')
           .text(cellVal, x + 5, y + 6, { width: colW - 10, ellipsis: true });
      }
      x += colW;
    });

    doc.moveTo(margin, y + rowH).lineTo(margin + contentW, y + rowH)
       .strokeColor(COLOR_BORDER).lineWidth(0.3).stroke();
    y += rowH;
  });

  // Actualizar doc.y al final de la tabla sin desbordarse
  doc.y = Math.min(y + 12, safeBottom);
}
