import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from "recharts";
import { authService } from "../services/authService";
import { reportService, ReportData, ReportFilters } from "../services/reportService";
import { useTheme } from "../context/ThemeContext";
import "../styles.css";

const ESTADO_COLORS: Record<string, string> = {
  Abiertos:     "#ef4444",
  "En progreso": "#f59e0b",
  Cerrados:     "#10b981",
};

const PRIORIDAD_COLORS: Record<string, string> = {
  Alta:  "#ef4444",
  Media: "#f59e0b",
  Baja:  "#10b981",
};

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div style={{
      padding: "18px 20px",
      backgroundColor: isDark ? "#1e1e1e" : "#f8fafc",
      borderRadius: "8px",
      border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
      minWidth: "130px",
    }}>
      <p style={{ fontSize: "11px", color: isDark ? "#aaaaaa" : "#64748b", margin: "0 0 6px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <h2 style={{ margin: "0", fontSize: "26px", color: isDark ? "#f5f5f5" : "#1e293b" }}>{value ?? "—"}</h2>
      {sub && <p style={{ fontSize: "11px", color: isDark ? "#888888" : "#94a3b8", margin: "4px 0 0 0" }}>{sub}</p>}
    </div>
  );
}

function Reports() {
  const navigate = useNavigate();
  const [user, setUser]       = useState<any>(null);
  const [agentes, setAgentes] = useState<any[]>([]);
  const [data, setData]       = useState<ReportData | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [downloading, setDownloading]   = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const [filters, setFilters] = useState<ReportFilters>({
    start_date: "",
    end_date:   "",
    agent_id:   "",
    status:     "",
  });

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate("/"); return; }
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== "administrador") { navigate("/dashboard"); return; }
    setUser(currentUser);

    authService.getAgents()
      .then(setAgentes)
      .catch(() => {});

    cargarReporte({});
  }, [navigate]);

  const cargarReporte = async (f: ReportFilters) => {
    setLoading(true);
    setError("");
    try {
      const result = await reportService.getReport(f);
      setData(result);
    } catch (err: any) {
      setError(err.message || "Error al cargar el reporte");
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltros = () => {
    const active: ReportFilters = {};
    if (filters.start_date) active.start_date = filters.start_date;
    if (filters.end_date)   active.end_date   = filters.end_date;
    if (filters.agent_id)   active.agent_id   = filters.agent_id;
    if (filters.status)     active.status     = filters.status;
    cargarReporte(active);
  };

  const limpiarFiltros = () => {
    const clean = { start_date: "", end_date: "", agent_id: "", status: "" };
    setFilters(clean);
    cargarReporte({});
  };

  const descargarReporte = async () => {
    setDownloading(true);
    setDownloadError("");
    try {
      const active: ReportFilters = {};
      if (filters.start_date) active.start_date = filters.start_date;
      if (filters.end_date)   active.end_date   = filters.end_date;
      if (filters.agent_id)   active.agent_id   = filters.agent_id;
      if (filters.status)     active.status     = filters.status;
      await reportService.downloadReport(active);
    } catch (err: any) {
      setDownloadError(err.message || "Error al descargar el reporte");
    } finally {
      setDownloading(false);
    }
  };

  const hayFiltros = !!(filters.start_date || filters.end_date || filters.agent_id || filters.status);

  const logout = () => { authService.logout(); navigate("/"); };

  const { theme, toggleTheme } = useTheme();

  const isDark      = theme === "dark";
  const axisColor   = isDark ? "#aaaaaa" : "#6b7280";
  const gridColor   = isDark ? "#334155" : "#e5e7eb";
  const tooltipBg   = isDark ? "#1e293b" : "#ffffff";
  const tooltipText = isDark ? "#f5f5f5" : "#374151";

  if (!user) return null;

  // Datos para los gráficos
  const dataPorEstado = data ? [
    { name: "Abiertos",      value: data.resumen.abiertos,    fill: "#ef4444" },
    { name: "En progreso",   value: data.resumen.en_progreso, fill: "#f59e0b" },
    { name: "Cerrados",      value: data.resumen.cerrados,    fill: "#10b981" },
  ] : [];

  const dataPorPrioridad = data ? [
    { name: "Alta",  value: data.resumen.alta,  fill: "#ef4444" },
    { name: "Media", value: data.resumen.media, fill: "#f59e0b" },
    { name: "Baja",  value: data.resumen.baja,  fill: "#10b981" },
  ] : [];

  const dataPorAgente = data?.por_agente.map(a => ({
    name:        a.agente,
    Total:       a.total,
    Cerrados:    a.cerrados,
    "En progreso": a.en_progreso,
    Abiertos:    a.abiertos,
  })) ?? [];

  // Distribución de estrellas (1–5) para gráfico de barras
  const dataDistribucion = data?.calificaciones ? [
    { name: "1 ★", value: data.calificaciones.general.estrellas_1, fill: "#ef4444" },
    { name: "2 ★", value: data.calificaciones.general.estrellas_2, fill: "#f97316" },
    { name: "3 ★", value: data.calificaciones.general.estrellas_3, fill: "#f59e0b" },
    { name: "4 ★", value: data.calificaciones.general.estrellas_4, fill: "#84cc16" },
    { name: "5 ★", value: data.calificaciones.general.estrellas_5, fill: "#10b981" },
  ] : [];

  // Tabla unificada: une datos de ticket + calificaciones por agente
  const agentesUnificados = data ? data.calificaciones.por_agente.map(ca => {
    const ticket = data.por_agente.find(a => a.agente === ca.agente);
    return { ...ca, ...ticket };
  }) : [];

  return (
    <div className="dashboard-container">
      {/* SIDEBAR */}
      <div className="sidebar">
        <h2>Sistek</h2>
        <button onClick={() => navigate("/dashboard")}>Inicio</button>
        <button onClick={() => navigate("/admin-tickets")}>Todos los Tickets</button>
        <button onClick={() => navigate("/reports")} style={{ backgroundColor: "#6366f1", color: "white" }}>
          Reportes
        </button>
        <button onClick={toggleTheme} style={{ marginTop: "auto" }}>
          {theme === "dark" ? "☀️ Modo Claro" : "🌙 Modo Oscuro"}
        </button>
        <button onClick={logout}>Cerrar sesión</button>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="main-content">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0" }}>Reportes de Gestión</h1>
            <p style={{ color: "#64748b", margin: 0 }}>Métricas y análisis de tickets del sistema</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
            <button
              onClick={descargarReporte}
              disabled={downloading || loading}
              style={{
                padding: "10px 20px",
                backgroundColor: downloading ? "#94a3b8" : "#10b981",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: downloading || loading ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {downloading ? "Generando PDF..." : "Descargar PDF"}
            </button>
            {downloadError && (
              <p style={{ fontSize: "12px", color: "#ef4444", margin: 0, maxWidth: "220px", textAlign: "right" }}>
                {downloadError}
              </p>
            )}
          </div>
        </div>

        {/* FILTROS */}
        <div className="card" style={{ marginBottom: "20px" }}>
          <h3 style={{ marginTop: 0, marginBottom: "14px", color: "#374151" }}>Filtros</h3>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Fecha inicio</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))}
                style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "13px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Fecha fin</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))}
                style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "13px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Agente</label>
              <select
                value={filters.agent_id}
                onChange={e => setFilters(f => ({ ...f, agent_id: e.target.value }))}
                style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "13px", backgroundColor: "white" }}
              >
                <option value="">Todos los agentes</option>
                {agentes.map(a => (
                  <option key={a.id} value={a.id}>{a.username}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Estado</label>
              <select
                value={filters.status}
                onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "13px", backgroundColor: "white" }}
              >
                <option value="">Todos los estados</option>
                <option value="Abierto">Abierto</option>
                <option value="En progreso">En progreso</option>
                <option value="Cerrado">Cerrado</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={aplicarFiltros}
                style={{ padding: "8px 18px", backgroundColor: "#6366f1", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}
              >
                Aplicar
              </button>
              {hayFiltros && (
                <button
                  onClick={limpiarFiltros}
                  style={{ padding: "8px 14px", backgroundColor: "#e5e7eb", color: "#374151", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }}
                >
                  ✕ Limpiar
                </button>
              )}
            </div>
          </div>
          {hayFiltros && (
            <p style={{ fontSize: "12px", color: "#6366f1", marginTop: "10px", marginBottom: 0 }}>
              Filtros activos: {[
                filters.start_date && `desde ${filters.start_date}`,
                filters.end_date   && `hasta ${filters.end_date}`,
                filters.agent_id   && `agente: ${agentes.find(a => String(a.id) === filters.agent_id)?.username ?? filters.agent_id}`,
                filters.status     && `estado: ${filters.status}`,
              ].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {error && (
          <div className="card" style={{ borderLeft: "4px solid #ef4444", marginBottom: "20px" }}>
            <p style={{ color: "#ef4444", margin: 0 }}>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="card"><p style={{ textAlign: "center", color: "#6b7280" }}>Cargando reporte...</p></div>
        ) : data ? (
          <>
            {/* MÉTRICAS GENERALES */}
            <div className="card" style={{ marginBottom: "20px" }}>
              <h3 style={{ marginTop: 0, color: "#374151" }}>Métricas Generales</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
                <MetricCard label="Total tickets"   value={data.resumen.total} />
                <MetricCard label="Abiertos"        value={data.resumen.abiertos} />
                <MetricCard label="En progreso"     value={data.resumen.en_progreso} />
                <MetricCard label="Cerrados"        value={data.resumen.cerrados} />
                <MetricCard
                  label="Prom. respuesta"
                  value={data.resumen.avg_respuesta_horas !== null ? `${data.resumen.avg_respuesta_horas} h` : "—"}
                  sub="Tiempo hasta primer avance"
                />
                <MetricCard
                  label="Prom. resolución"
                  value={data.resumen.avg_resolucion_horas !== null ? `${data.resumen.avg_resolucion_horas} h` : "—"}
                  sub="Solo tickets cerrados"
                />
              </div>
            </div>

            {/* MÉTRICAS POR PRIORIDAD */}
            <div className="card" style={{ marginBottom: "20px" }}>
              <h3 style={{ marginTop: 0, color: "#374151" }}>Tickets por Prioridad</h3>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {dataPorPrioridad.map(p => (
                  <div key={p.name} style={{
                    flex: 1, minWidth: "110px", padding: "14px",
                    backgroundColor: "#f8fafc", borderRadius: "8px",
                    border: `2px solid ${p.fill}22`,
                    borderLeft: `4px solid ${p.fill}`,
                    textAlign: "center"
                  }}>
                    <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 6px 0" }}>{p.name}</p>
                    <h2 style={{ margin: 0, color: p.fill }}>{p.value}</h2>
                  </div>
                ))}
              </div>
            </div>

            {/* GRÁFICOS EN DOS COLUMNAS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              {/* Gráfico por estado */}
              <div className="card">
                <h3 style={{ marginTop: 0, color: "#374151" }}>Tickets por Estado</h3>
                {data.resumen.total === 0 ? (
                  <p style={{ color: "#6b7280", textAlign: "center", padding: "30px 0" }}>Sin datos para mostrar</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dataPorEstado} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                      <XAxis dataKey="name" fontSize={12} tick={{ fill: axisColor }} axisLine={{ stroke: gridColor }} tickLine={{ stroke: gridColor }} />
                      <YAxis fontSize={12} allowDecimals={false} tick={{ fill: axisColor }} axisLine={{ stroke: gridColor }} tickLine={{ stroke: gridColor }} />
                      <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${gridColor}`, color: tooltipText }} labelStyle={{ color: tooltipText }} />
                      <Bar dataKey="value" name="Tickets" radius={[4, 4, 0, 0]}>
                        {dataPorEstado.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Gráfico por agente */}
              <div className="card">
                <h3 style={{ marginTop: 0, color: "#374151" }}>Tickets por Agente</h3>
                {dataPorAgente.length === 0 ? (
                  <p style={{ color: "#6b7280", textAlign: "center", padding: "30px 0" }}>
                    {filters.agent_id || filters.status ? "Sin datos con los filtros seleccionados" : "No hay tickets asignados a agentes"}
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dataPorAgente} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                      <XAxis dataKey="name" fontSize={11} tick={{ fill: axisColor }} axisLine={{ stroke: gridColor }} tickLine={{ stroke: gridColor }} />
                      <YAxis fontSize={12} allowDecimals={false} tick={{ fill: axisColor }} axisLine={{ stroke: gridColor }} tickLine={{ stroke: gridColor }} />
                      <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${gridColor}`, color: tooltipText }} labelStyle={{ color: tooltipText }} />
                      <Legend fontSize={11} wrapperStyle={{ color: axisColor }} />
                      <Bar dataKey="Cerrados"      fill="#10b981" radius={[2, 2, 0, 0]} stackId="a" />
                      <Bar dataKey="En progreso"   fill="#f59e0b" radius={[2, 2, 0, 0]} stackId="a" />
                      <Bar dataKey="Abiertos"      fill="#ef4444" radius={[2, 2, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* SECCIÓN: SATISFACCIÓN DEL CLIENTE */}
            {data.calificaciones && (
              <>
                {/* ── Métricas generales de satisfacción ── */}
                <div className="card" style={{ marginBottom: "20px" }}>
                  <h3 style={{ marginTop: 0, color: isDark ? "#f5f5f5" : "#374151" }}>
                    Satisfacción del Cliente
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px" }}>
                    <MetricCard
                      label="Tickets calificados"
                      value={data.calificaciones.general.calificados}
                      sub={`de ${data.calificaciones.general.cerrados_total} cerrados`}
                    />
                    <MetricCard
                      label="Sin calificar"
                      value={data.calificaciones.general.no_calificados}
                      sub="pendientes de valoración"
                    />
                    <MetricCard
                      label="Promedio general"
                      value={data.calificaciones.general.promedio_general !== null
                        ? `${data.calificaciones.general.promedio_general} ★` : "—"}
                      sub="sobre 5 estrellas"
                    />
                    <MetricCard
                      label="% Satisfacción"
                      value={data.calificaciones.general.pct_satisfaccion !== null
                        ? `${data.calificaciones.general.pct_satisfaccion}%` : "—"}
                      sub="calificaciones ≥ 4 ★"
                    />
                  </div>
                </div>

                {/* ── Gráfico de distribución de calificaciones ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                  <div className="card">
                    <h3 style={{ marginTop: 0, color: isDark ? "#f5f5f5" : "#374151" }}>
                      Distribución de Calificaciones
                    </h3>
                    {data.calificaciones.general.calificados === 0 ? (
                      <p style={{ color: "#6b7280", textAlign: "center", padding: "30px 0" }}>
                        Sin calificaciones registradas
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={dataDistribucion} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                          <XAxis dataKey="name" fontSize={12} tick={{ fill: axisColor }} axisLine={{ stroke: gridColor }} tickLine={{ stroke: gridColor }} />
                          <YAxis fontSize={12} allowDecimals={false} tick={{ fill: axisColor }} axisLine={{ stroke: gridColor }} tickLine={{ stroke: gridColor }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${gridColor}`, color: tooltipText }}
                            labelStyle={{ color: tooltipText }}
                            formatter={(v: any) => [`${v} calificación${v !== 1 ? "es" : ""}`, ""]}
                          />
                          <Bar dataKey="value" name="Calificaciones" radius={[4, 4, 0, 0]}>
                            {dataDistribucion.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* ── Desglose numérico de distribución ── */}
                  <div className="card">
                    <h3 style={{ marginTop: 0, color: isDark ? "#f5f5f5" : "#374151" }}>
                      Detalle de Distribución
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {[
                        { stars: 5, count: data.calificaciones.general.estrellas_5, color: "#10b981" },
                        { stars: 4, count: data.calificaciones.general.estrellas_4, color: "#84cc16" },
                        { stars: 3, count: data.calificaciones.general.estrellas_3, color: "#f59e0b" },
                        { stars: 2, count: data.calificaciones.general.estrellas_2, color: "#f97316" },
                        { stars: 1, count: data.calificaciones.general.estrellas_1, color: "#ef4444" },
                      ].map(({ stars, count, color }) => {
                        const total = data.calificaciones.general.calificados;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={stars} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "13px", color, fontWeight: "bold", minWidth: "28px" }}>
                              {stars}★
                            </span>
                            <div style={{ flex: 1, height: "10px", backgroundColor: isDark ? "#334155" : "#e2e8f0", borderRadius: "5px", overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: "5px", transition: "width 0.3s" }} />
                            </div>
                            <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", minWidth: "60px", textAlign: "right" }}>
                              {count} ({pct}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── Tabla unificada por agente (tickets + calificaciones) ── */}
                <div className="card" style={{ marginBottom: "20px" }}>
                  <h3 style={{ marginTop: 0, color: isDark ? "#f5f5f5" : "#374151" }}>
                    Desempeño y Satisfacción por Agente
                  </h3>
                  {agentesUnificados.length === 0 ? (
                    <p style={{ color: "#6b7280", textAlign: "center", padding: "20px 0" }}>
                      No hay agentes registrados.
                    </p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                        <thead>
                          <tr style={{ backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }}>
                            {[
                              "Agente",
                              "Total", "Abiertos", "En progreso", "Cerrados", "Prom. resol.",
                              "Calif.", "Promedio ★", "% Satisf.",
                              "1★", "2★", "3★", "4★", "5★"
                            ].map(h => (
                              <th key={h} style={{
                                padding: "9px 10px", textAlign: "left", fontSize: "11px",
                                color: isDark ? "#94a3b8" : "#475569", fontWeight: "600",
                                borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                                whiteSpace: "nowrap"
                              }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {agentesUnificados.map((a: any, i: number) => (
                            <tr key={a.agente_id} style={{
                              backgroundColor: i % 2 === 0
                                ? (isDark ? "transparent" : "white")
                                : (isDark ? "#1e293b" : "#f8fafc")
                            }}>
                              <td style={{ padding: "9px 10px", fontWeight: "600", color: isDark ? "#f1f5f9" : "#1e293b", borderBottom: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}` }}>
                                {a.agente}
                              </td>
                              <td style={{ padding: "9px 10px", borderBottom: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}`, color: isDark ? "#cbd5e1" : undefined }}>
                                {a.total ?? "—"}
                              </td>
                              <td style={{ padding: "9px 10px", borderBottom: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}` }}>
                                <span style={{ color: "#ef4444", fontWeight: "bold" }}>{a.abiertos ?? "—"}</span>
                              </td>
                              <td style={{ padding: "9px 10px", borderBottom: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}` }}>
                                <span style={{ color: "#f59e0b", fontWeight: "bold" }}>{a.en_progreso ?? "—"}</span>
                              </td>
                              <td style={{ padding: "9px 10px", borderBottom: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}` }}>
                                <span style={{ color: "#10b981", fontWeight: "bold" }}>{a.cerrados ?? "—"}</span>
                              </td>
                              <td style={{ padding: "9px 10px", borderBottom: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}`, color: "#6366f1", fontWeight: "bold" }}>
                                {a.avg_resolucion_horas != null ? `${a.avg_resolucion_horas} h` : "—"}
                              </td>
                              <td style={{ padding: "9px 10px", borderBottom: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}`, color: isDark ? "#cbd5e1" : undefined }}>
                                {a.total_calificaciones}
                              </td>
                              <td style={{ padding: "9px 10px", borderBottom: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}` }}>
                                {a.promedio_calificacion !== null ? (
                                  <span style={{ color: "#f59e0b", fontWeight: "bold" }}>
                                    {[1,2,3,4,5].map(s => (
                                      <span key={s} style={{ color: s <= Math.round(Number(a.promedio_calificacion)) ? "#f59e0b" : (isDark ? "#475569" : "#d1d5db"), fontSize: "13px" }}>★</span>
                                    ))}
                                    {" "}{a.promedio_calificacion}/5
                                  </span>
                                ) : (
                                  <span style={{ color: isDark ? "#64748b" : "#94a3b8", fontSize: "12px" }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: "9px 10px", borderBottom: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}` }}>
                                {a.pct_satisfaccion !== null ? (
                                  <span style={{
                                    color: Number(a.pct_satisfaccion) >= 80 ? "#10b981" : Number(a.pct_satisfaccion) >= 50 ? "#f59e0b" : "#ef4444",
                                    fontWeight: "bold"
                                  }}>
                                    {a.pct_satisfaccion}%
                                  </span>
                                ) : (
                                  <span style={{ color: isDark ? "#64748b" : "#94a3b8", fontSize: "12px" }}>—</span>
                                )}
                              </td>
                              {[a.estrellas_1, a.estrellas_2, a.estrellas_3, a.estrellas_4, a.estrellas_5].map((v: number, idx: number) => (
                                <td key={idx} style={{ padding: "9px 10px", borderBottom: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}`, color: isDark ? "#94a3b8" : "#64748b", textAlign: "center" }}>
                                  {v ?? 0}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

          </>
        ) : null}
      </div>
    </div>
  );
}

export default Reports;
