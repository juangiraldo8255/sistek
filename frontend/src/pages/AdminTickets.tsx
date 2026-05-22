import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ticketService, Ticket, PRIORIDADES, PrioridadTicket, PRIORIDAD_ORDEN } from "../services/ticketService";
import { commentService, Comment } from "../services/commentService";
import { authService } from "../services/authService";
import { useTheme } from "../context/ThemeContext";
import ReopenModal from "../components/ReopenModal";
import "../styles.css";

function AdminTickets() {
  const [user, setUser] = useState<any>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agentes, setAgentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("Todos");
  const [sortByPriority, setSortByPriority] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<{ [key: number]: string }>({});
  const [prioridadSeleccionada, setPrioridadSeleccionada] = useState<{ [key: number]: string }>({});
  const [loadingAssign, setLoadingAssign] = useState<number | null>(null);
  const [historialSelected, setHistorialSelected] = useState<any[]>([]);
  const [showHistorialId, setShowHistorialId] = useState<number | null>(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");

  // ESTADOS DE COMENTARIOS
  const [showCommentsId, setShowCommentsId] = useState<number | null>(null);
  const [comentarios, setComentarios] = useState<Comment[]>([]);
  const [loadingComentarios, setLoadingComentarios] = useState(false);
  const [nuevoComentario, setNuevoComentario] = useState<{ [key: number]: string }>({});
  const [errorComentario, setErrorComentario] = useState<{ [key: number]: string }>({});
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  // --- LÓGICA HU-009: CÁLCULO DE SLA ---
  const obtenerEstadoSLA = (ticket: Ticket) => {
    const ahora = new Date().getTime();
    const creacion = new Date(ticket.created_at).getTime();
    const transcurridoHoras = (ahora - creacion) / (1000 * 60 * 60);

    // Límites: Alta 4h, Media 24h, Baja 48h
    let limite = 48;
    if (ticket.priority === "Alta") limite = 4;
    if (ticket.priority === "Media") limite = 24;

    if (ticket.status === "Cerrado") {
      return { etiqueta: "Cumplido ✅", color: "#10b981", bg: "#dcfce7" };
    }

    if (transcurridoHoras > limite) {
      return { etiqueta: "INCUMPLIDO ⚠️", color: "#ef4444", bg: "#fee2e2" };
    } else {
      const restante = (limite - transcurridoHoras).toFixed(1);
      return { etiqueta: `En tiempo (${restante}h restantes)`, color: "#3b82f6", bg: "#dbeafe" };
    }
  };
  
  const navigate = useNavigate();

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate("/");
      return;
    }

    const userData = authService.getCurrentUser();
    if (userData && userData.role !== "administrador") {
      navigate("/dashboard");
      return;
    }

    setUser(userData);
    cargarDatos();
  }, [navigate]);

  useEffect(() => {
    if (user && !filtroBusqueda) {
      const interval = setInterval(() => {
        cargarDatos(false);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user, filtroBusqueda]);

  const cargarDatos = async (mostrarLoading = false) => {
    try {
      if (mostrarLoading) setLoading(true); 
      const todosTickets = await ticketService.getAllTickets();
      setTickets(todosTickets);
      
      const agentesData = await authService.getAgents();
      setAgentes(agentesData);
    } catch (err: any) {
      console.error("Error cargando datos:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const realizarBusqueda = async () => {
    const q = busqueda.trim();
    setFiltroBusqueda(q);
    try {
      const resultado = await ticketService.searchTickets(q);
      setTickets(resultado);
    } catch (err: any) {
      console.error("Error buscando tickets:", err.message);
    }
  };

  const limpiarBusqueda = async () => {
    setBusqueda("");
    setFiltroBusqueda("");
    await cargarDatos();
  };

  const asignarTicket = async (ticketId: number, agentId: number) => {
    try {
      setLoadingAssign(ticketId);
      await ticketService.assignTicketToAgent(ticketId, agentId);
      alert("Ticket asignado exitosamente");
      setSelectedAgents(prev => {
        const updated = { ...prev };
        delete updated[ticketId];
        return updated;
      });
      cargarDatos();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoadingAssign(null);
    }
  };

  const cambiarEstado = async (ticketId: number, nuevoEstado: 'Abierto' | 'En progreso' | 'Cerrado') => {
  try {
  
    await ticketService.updateTicketStatus(ticketId, nuevoEstado, user.id);
    alert("Estado actualizado y registrado en historial");
    cargarDatos(); 
  } catch (err: any) {
    alert("Error al cambiar estado: " + err.message);
  }
};

  const logout = () => {
    authService.logout();
    navigate("/");
  };

  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  // Paleta reutilizable para ticket cards en modo oscuro
  const dk = {
    card:          isDark ? "#1e1e1e"   : "#fafafa",
    cardBorder:    isDark ? "#334155"   : "#e5e7eb",
    text:          isDark ? "#f5f5f5"   : "#1f2937",
    textSub:       isDark ? "#aaaaaa"   : "#666",
    label:         isDark ? "#aaaaaa"   : "#374151",
    panelPriority: isDark ? "#2a1f18"   : "#fff7ed",
    labelPriority: isDark ? "#fb923c"   : "#9a3412",
    panelEstado:   isDark ? "#172520"   : "#f9fafb",
    labelEstado:   isDark ? "#34d399"   : "#047857",
    panelAssign:   isDark ? "#161e2e"   : "#f0f9ff",
    labelAssign:   isDark ? "#93c5fd"   : "#1e40af",
    input:         isDark ? "#0f172a"   : "white",
    inputBorder:   isDark ? "#475569"   : "#d1d5db",
    divider:       isDark ? "#334155"   : "#f3f4f6",
    expanded:      isDark ? "#121212"   : "#ffffff",
    expandedBorder:isDark ? "#334155"   : "#e5e7eb",
    histBtn:       isDark ? "#93c5fd"   : "#2563eb",
    commentBtn:    isDark ? "#c4b5fd"   : "#7c3aed",
    badgeBg:       isDark ? "#263248"   : "#f3f4f6",
  };

  // ESTADO MODAL REAPERTURA (HU-019)
  const [reopenTarget, setReopenTarget] = useState<Ticket | null>(null);

  const verHistorial = async (ticketId: number) => {
  // Si el usuario hace clic en el que ya está abierto, lo cerramos
  if (showHistorialId === ticketId) {
    setShowHistorialId(null);
    return;
  }

  try {
    setLoadingHistorial(true);
    const data = await ticketService.getTicketHistory(ticketId);
    setHistorialSelected(data);
    setShowHistorialId(ticketId);
  } catch (err: any) {
    console.error("Error al cargar historial:", err.message);
    alert("No se pudo cargar el historial.");
  } finally {
    setLoadingHistorial(false);
  }
};

  const verComentarios = async (ticketId: number) => {
    if (showCommentsId === ticketId) {
      setShowCommentsId(null);
      return;
    }
    try {
      setLoadingComentarios(true);
      const data = await commentService.getComments(ticketId);
      setComentarios(data);
      setShowCommentsId(ticketId);
    } catch (err) {
      console.error("Error al cargar comentarios");
    } finally {
      setLoadingComentarios(false);
    }
  };

  const enviarComentario = async (ticketId: number) => {
    const content = nuevoComentario[ticketId]?.trim();
    if (!content) {
      setErrorComentario(prev => ({ ...prev, [ticketId]: 'El comentario no puede estar vacío' }));
      return;
    }
    try {
      setEnviandoComentario(true);
      setErrorComentario(prev => ({ ...prev, [ticketId]: '' }));
      await commentService.createComment(ticketId, content);
      setNuevoComentario(prev => ({ ...prev, [ticketId]: '' }));
      const data = await commentService.getComments(ticketId);
      setComentarios(data);
    } catch (err: any) {
      setErrorComentario(prev => ({ ...prev, [ticketId]: err.message }));
    } finally {
      setEnviandoComentario(false);
    }
  };

  const eliminarTicket = async (ticketId: number) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el ticket #${ticketId}? Esta acción no se puede deshacer.`)) return;
    try {
      await ticketService.deleteTicket(ticketId);
      cargarDatos();
    } catch (err: any) {
      alert("Error al eliminar ticket: " + err.message);
    }
  };

  const cambiarPrioridad = async (ticketId: number, newPriority: PrioridadTicket) => {
    try {
      await ticketService.updateTicketPriority(ticketId, newPriority);
      setPrioridadSeleccionada(prev => { const n = { ...prev }; delete n[ticketId]; return n; });
      cargarDatos();
    } catch (err: any) {
      alert("Error actualizando prioridad: " + err.message);
    }
  };

  const ticketsFiltrados = filtroEstado === "Todos"
    ? tickets
    : tickets.filter(t => t.status === filtroEstado);

  const ticketsFiltraos = sortByPriority
    ? [...ticketsFiltrados].sort((a, b) => (PRIORIDAD_ORDEN[a.priority] ?? 4) - (PRIORIDAD_ORDEN[b.priority] ?? 4))
    : ticketsFiltrados;

  if (!user) return null;

  return (
    <div className="dashboard-container">

      {/* MODAL REAPERTURA (HU-019) */}
      {reopenTarget && (
        <ReopenModal
          ticket={reopenTarget}
          userRole="administrador"
          onConfirm={async (motivo) => {
            await ticketService.reopenTicket(reopenTarget.id, motivo);
            setReopenTarget(null);
            await cargarDatos();
          }}
          onClose={() => setReopenTarget(null)}
        />
      )}

      <div className="sidebar">
        <h2>Sistek</h2>
        <button onClick={() => navigate("/dashboard")}>Inicio</button>
        <button onClick={() => navigate("/admin-tickets")} style={{ backgroundColor: "#3b82f6", color: "white" }}>
          Todos los Tickets
        </button>
        <button onClick={() => navigate("/reports")}>Reportes</button>
        <button onClick={toggleTheme} style={{ marginTop: "auto" }}>
          {theme === "dark" ? "☀️ Modo Claro" : "🌙 Modo Oscuro"}
        </button>
        <button onClick={logout}>Cerrar sesión</button>
      </div>

      <div className="main-content">
        <h1>Gestión de Tickets</h1>

        <div className="card">
          {/* BARRA DE BÚSQUEDA */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Buscar por título o descripción..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && realizarBusqueda()}
              style={{
                flex: 1,
                padding: "11px 16px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px",
                color: "#1f2937",
                backgroundColor: "white",
                marginTop: "0",
                boxSizing: "border-box"
              }}
            />
            <button
              onClick={realizarBusqueda}
              style={{
                backgroundColor: "#3b82f6",
                color: "white",
                padding: "8px 18px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
                width: "auto",
                marginTop: "0",
                flexShrink: 0
              }}
            >
              Buscar
            </button>
            {filtroBusqueda && (
              <button
                onClick={limpiarBusqueda}
                style={{
                  backgroundColor: "#e5e7eb",
                  color: "#374151",
                  padding: "8px 14px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                  width: "auto",
                  marginTop: "0",
                  flexShrink: 0
                }}
              >
                ✕ Limpiar
              </button>
            )}
          </div>
          {filtroBusqueda && (
            <p style={{ color: "#6b7280", fontSize: "13px", marginBottom: "12px" }}>
              Resultados para: <strong>"{filtroBusqueda}"</strong> ({tickets.length} encontrado{tickets.length !== 1 ? "s" : ""})
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0 }}>Filtrar por Estado</h3>
            <button
              onClick={() => setSortByPriority(s => !s)}
              style={{
                backgroundColor: sortByPriority ? "#6366f1" : "#e5e7eb",
                color: sortByPriority ? "white" : "#374151",
                padding: "7px 14px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "bold"
              }}
            >
              ↕ {sortByPriority ? "Orden: Prioridad" : "Ordenar por Prioridad"}
            </button>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={() => setFiltroEstado("Todos")}
              style={{
                backgroundColor: filtroEstado === "Todos" ? "#3b82f6" : "#e5e7eb",
                color: filtroEstado === "Todos" ? "white" : "#374151",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              Todos ({tickets.length})
            </button>
            <button
              onClick={() => setFiltroEstado("Abierto")}
              style={{
                backgroundColor: filtroEstado === "Abierto" ? "#ef4444" : "#e5e7eb",
                color: filtroEstado === "Abierto" ? "white" : "#374151",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              Abierto ({tickets.filter(t => t.status === "Abierto").length})
            </button>
            <button
              onClick={() => setFiltroEstado("En progreso")}
              style={{
                backgroundColor: filtroEstado === "En progreso" ? "#f59e0b" : "#e5e7eb",
                color: filtroEstado === "En progreso" ? "white" : "#374151",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              En progreso ({tickets.filter(t => t.status === "En progreso").length})
            </button>
            <button
              onClick={() => setFiltroEstado("Cerrado")}
              style={{
                backgroundColor: filtroEstado === "Cerrado" ? "#10b981" : "#e5e7eb",
                color: filtroEstado === "Cerrado" ? "white" : "#374151",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              Cerrado ({tickets.filter(t => t.status === "Cerrado").length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card">
            <p>Cargando tickets...</p>
          </div>
        ) : ticketsFiltraos.length === 0 ? (
          <div className="card">
            <p style={{ color: "#6b7280", textAlign: "center" }}>
              {filtroBusqueda
                ? `No se encontraron tickets con "${filtroBusqueda}"`
                : "No hay tickets para mostrar"}
            </p>
          </div>
        ) : (
          <div className="card">
            <h3>Tickets ({ticketsFiltraos.length})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "15px" }}>
              {ticketsFiltraos.map((ticket) => {
  const sla = obtenerEstadoSLA(ticket);

  return (
    <div
      key={ticket.id}
      style={{
        border: `2px solid ${dk.cardBorder}`,
        borderRadius: "8px",
        padding: "15px",
        backgroundColor: dk.card,
        position: "relative"
      }}
    >
      <div style={{ 
        position: "absolute", top: "15px", right: "15px", 
        padding: "5px 12px", borderRadius: "20px", 
        backgroundColor: sla.bg, color: sla.color, 
        fontSize: "11px", fontWeight: "bold",
        border: `1px solid ${sla.color}`, zIndex: 1
      }}>
        SLA: {sla.etiqueta}
      </div>

      <div style={{ marginBottom: "12px" }}>
        <h4 style={{ margin: "0 0 5px 0", color: dk.text, fontSize: "16px" }}>
          #{ticket.id} - {ticket.title}
        </h4>
        <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: dk.textSub }}>
          {ticket.description}
        </p>
      </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginBottom: "12px", fontSize: "13px" }}>
                    <div>
                      <strong style={{ color: dk.label }}>Estado:</strong>
                      <div style={{
                        padding: "4px 8px",
                        backgroundColor: 
                          ticket.status === "Abierto" ? "#fee2e2" :
                          ticket.status === "En progreso" ? "#fef3c7" :
                          "#dcfce7",
                        color:
                          ticket.status === "Abierto" ? "#991b1b" :
                          ticket.status === "En progreso" ? "#92400e" :
                          "#166534",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        marginTop: "4px"
                      }}>
                        {ticket.status}
                      </div>
                    </div>

                    <div>
                      <strong style={{ color: dk.label }}>Prioridad:</strong>
                      <div style={{
                        padding: "4px 8px",
                        backgroundColor:
                          ticket.priority === "Alta" ? "#fee2e2" :
                          ticket.priority === "Media" ? "#fef3c7" :
                          "#dcfce7",
                        color:
                          ticket.priority === "Alta" ? "#991b1b" :
                          ticket.priority === "Media" ? "#92400e" :
                          "#166534",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        marginTop: "4px"
                      }}>
                        {ticket.priority}
                      </div>
                    </div>

                    <div>
                      <strong style={{ color: dk.label }}>Tipo:</strong>
                      <div style={{
                        padding: "4px 8px",
                        backgroundColor: dk.badgeBg,
                        color: dk.label,
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        marginTop: "4px"
                      }}>
                        {ticket.type}
                      </div>
                    </div>
                  </div>

                  {/* CAMBIAR PRIORIDAD */}
                  <div style={{ backgroundColor: dk.panelPriority, padding: "12px", borderRadius: "6px", marginBottom: "10px", borderLeft: "4px solid #f97316" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", color: dk.labelPriority, marginBottom: "8px" }}>
                      Cambiar Prioridad:
                    </label>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <select
                        value={prioridadSeleccionada[ticket.id] ?? ""}
                        onChange={(e) => setPrioridadSeleccionada(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                        style={{ padding: "8px", border: `1px solid ${dk.inputBorder}`, borderRadius: "4px", fontSize: "13px", flex: 1, backgroundColor: dk.input, color: dk.text, cursor: "pointer" }}
                      >
                        <option value="">Selecciona prioridad...</option>
                        {PRIORIDADES.filter(p => p !== ticket.priority).map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const p = prioridadSeleccionada[ticket.id] as PrioridadTicket;
                          if (p) cambiarPrioridad(ticket.id, p);
                        }}
                        disabled={!prioridadSeleccionada[ticket.id]}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: prioridadSeleccionada[ticket.id] ? "#f97316" : "#d1d5db",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: prioridadSeleccionada[ticket.id] ? "pointer" : "not-allowed",
                          fontSize: "13px",
                          fontWeight: "bold",
                          whiteSpace: "nowrap"
                        }}
                      >
                        Actualizar
                      </button>
                    </div>
                  </div>

                  {/* --- SECCIÓN PARA CAMBIAR ESTADO (HU-007) --- */}
<div style={{
  backgroundColor: dk.panelEstado,
  padding: "12px",
  borderRadius: "6px",
  marginBottom: "10px",
  borderLeft: "4px solid #10b981"
}}>
  <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", color: dk.labelEstado, marginBottom: "8px" }}>
    Gestionar Estado del Ticket:
  </label>
  <select
    value={ticket.status}
    onChange={(e) => cambiarEstado(ticket.id, e.target.value as 'Abierto' | 'En progreso' | 'Cerrado')}
    style={{
      width: "100%",
      padding: "8px",
      borderRadius: "4px",
      border: `1px solid ${dk.inputBorder}`,
      fontSize: "13px",
      backgroundColor: dk.input,
      color: dk.text,
      cursor: "pointer"
    }}
  >
    <option value="Abierto">🔴 Abierto</option>
    <option value="En progreso">🟠 En progreso</option>
    <option value="Cerrado">🟢 Cerrado</option>
  </select>
</div>

                  {ticket.status !== "Cerrado" && (
                    <div style={{ backgroundColor: dk.panelAssign, padding: "12px", borderRadius: "6px", marginBottom: "10px", borderLeft: "4px solid #3b82f6" }}>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", color: dk.labelAssign, marginBottom: "8px" }}>
                        Asignar a Agente:
                      </label>
                      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                        <select
                          value={selectedAgents[ticket.id] || ""}
                          onChange={(e) => {
                            setSelectedAgents(prev => ({
                              ...prev,
                              [ticket.id]: e.target.value
                            }));
                          }}
                          style={{
                            padding: "8px",
                            border: `1px solid ${dk.inputBorder}`,
                            borderRadius: "4px",
                            fontSize: "13px",
                            cursor: "pointer",
                            flex: 1,
                            backgroundColor: dk.input,
                            color: dk.text
                          }}
                        >
                          <option value="">Selecciona un agente...</option>
                          {agentes.map(agente => (
                            <option key={agente.id} value={agente.id}>
                              {agente.username}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const agentId = parseInt(selectedAgents[ticket.id]);
                            if (!isNaN(agentId)) {
                              asignarTicket(ticket.id, agentId);
                            }
                          }}
                          disabled={!selectedAgents[ticket.id] || loadingAssign === ticket.id}
                          style={{
                            padding: "8px 16px",
                            backgroundColor: selectedAgents[ticket.id] ? "#3b82f6" : "#d1d5db",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: selectedAgents[ticket.id] ? "pointer" : "not-allowed",
                            fontSize: "13px",
                            fontWeight: "bold",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {loadingAssign === ticket.id ? "Asignando..." : "Asignar"}
                        </button>
                        {ticket.assigned_agent_id && (
                          <div style={{ fontSize: "12px", color: dk.labelAssign, whiteSpace: "nowrap" }}>
                            ✓ Asignado
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: "12px", color: dk.textSub, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <span>Creado: {new Date(ticket.created_at).toLocaleString()}</span>
                    <span>Cliente ID: {ticket.user_id}</span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {ticket.status === "Cerrado" && (
                        <button
                          onClick={() => setReopenTarget(ticket)}
                          style={{ backgroundColor: "#6366f1", color: "white", padding: "4px 12px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}
                        >
                          🔄 Reabrir
                        </button>
                      )}
                      <button
                        onClick={() => eliminarTicket(ticket.id)}
                        style={{ backgroundColor: "#ef4444", color: "white", padding: "4px 12px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                  {/* --- BOTÓN Y VISTA DE HISTORIAL (HU-007) --- */}
<div style={{ marginTop: "15px", borderTop: "1px dashed #ccc", paddingTop: "10px" }}>
  <button
    onClick={() => verHistorial(ticket.id)}
    style={{
      background: "none",
      border: "none",
      color: dk.histBtn,
      fontSize: "13px",
      fontWeight: "bold",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "5px"
    }}
  >
    {showHistorialId === ticket.id ? "▲ Ocultar Actividad" : "▼ Ver Actividad Reciente"}
    {loadingHistorial && showHistorialId === ticket.id && " (Cargando...)"}
  </button>

  {showHistorialId === ticket.id && (
    <div style={{
      marginTop: "10px",
      backgroundColor: dk.expanded,
      padding: "10px",
      borderRadius: "6px",
      border: `1px solid ${dk.expandedBorder}`,
      maxHeight: "200px",
      overflowY: "auto"
    }}>
      {historialSelected.length === 0 ? (
        <p style={{ fontSize: "12px", color: dk.textSub, textAlign: "center" }}>No hay registros aún.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {historialSelected.map((h, index) => (
            <li key={index} style={{
              fontSize: "12px",
              padding: "8px 0",
              borderBottom: index !== historialSelected.length - 1 ? `1px solid ${dk.divider}` : "none"
            }}>
              <div style={{ color: dk.text, fontWeight: "600" }}>
                {h.tipo_accion === 'status_change'
                  ? '🔄 Cambio de Estado'
                  : h.tipo_accion === 'priority_change'
                  ? '🎯 Cambio de Prioridad'
                  : h.tipo_accion === 'reopen'
                  ? '🔄 Reapertura'
                  : '👤 Asignación de Agente'}
              </div>
              <div style={{ color: dk.label }}>
                {h.tipo_accion === 'status_change' || h.tipo_accion === 'priority_change' || h.tipo_accion === 'reopen'
                  ? `De "${h.valor_anterior}" a "${h.valor_nuevo}"`
                  : `Asignado a Agente ID: ${h.valor_nuevo}`}
              </div>
              <div style={{ fontSize: "11px", color: dk.textSub, marginTop: "2px" }}>
                {new Date(new Date(h.fecha_registro + (h.fecha_registro.includes('Z') ? '' : 'Z')).getTime() - 5 * 60 * 60 * 1000).toLocaleString('es-ES', { hour12: false })} • Por Usuario ID: {h.usuario_accion_id}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )}
</div>

                  {/* --- SECCIÓN DE COMENTARIOS (ADMIN) --- */}
                  <div style={{ marginTop: "10px", borderTop: "1px dashed #d1d5db", paddingTop: "10px" }}>
                    <button
                      onClick={() => verComentarios(ticket.id)}
                      style={{ background: "none", border: "none", color: dk.commentBtn, fontSize: "13px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", padding: "0" }}
                    >
                      {showCommentsId === ticket.id ? "▲ Ocultar Comentarios" : "▼ Ver Comentarios"}
                      {loadingComentarios && showCommentsId === ticket.id && " (Cargando...)"}
                    </button>

                    {showCommentsId === ticket.id && (
                      <div style={{ marginTop: "10px", backgroundColor: dk.expanded, padding: "12px", borderRadius: "6px", border: `1px solid ${dk.expandedBorder}` }}>
                        {comentarios.length === 0 ? (
                          <p style={{ fontSize: "12px", color: dk.textSub, textAlign: "center", margin: "0 0 10px 0" }}>Sin comentarios aún.</p>
                        ) : (
                          <div style={{ marginBottom: "12px", maxHeight: "220px", overflowY: "auto" }}>
                            {comentarios.map((c) => (
                              <div key={c.id} style={{ padding: "8px 0", borderBottom: `1px solid ${dk.divider}` }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                                  <span style={{ fontSize: "12px", fontWeight: "bold", color: dk.text }}>{c.autor}</span>
                                  <span style={{ fontSize: "11px", color: dk.textSub }}>
                                    {new Date(c.created_at).toLocaleString('es-ES', { hour12: false })}
                                  </span>
                                </div>
                                <p style={{ margin: "0", fontSize: "13px", color: dk.label }}>{c.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        <div>
                          {errorComentario[ticket.id] && (
                            <p style={{ fontSize: "12px", color: "#ef4444", margin: "0 0 4px 0" }}>{errorComentario[ticket.id]}</p>
                          )}
                          <textarea
                            value={nuevoComentario[ticket.id] || ""}
                            onChange={(e) => setNuevoComentario(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                            placeholder="Escribe un comentario..."
                            style={{ width: "100%", padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "13px", resize: "vertical", minHeight: "60px", boxSizing: "border-box" }}
                          />
                          <button
                            onClick={() => enviarComentario(ticket.id)}
                            disabled={enviandoComentario}
                            style={{ marginTop: "6px", backgroundColor: "#7c3aed", color: "white", padding: "6px 16px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}
                          >
                            {enviandoComentario ? "Enviando..." : "Comentar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              );
})}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminTickets;
