import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ticketService, Ticket, PRIORIDADES, PrioridadTicket, PRIORIDAD_ORDEN } from "../services/ticketService";
import { commentService, Comment } from "../services/commentService";
import { authService } from "../services/authService";
import { useTheme } from "../context/ThemeContext";
import ReopenModal from "../components/ReopenModal";
import "../styles.css";

function Tickets() {

  const [user, setUser] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Media");
  const [type, setType] = useState("Software");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<{[key: number]: string}>({});
  const [prioridadSeleccionada, setPrioridadSeleccionada] = useState<{[key: number]: string}>({});
  const [sortByPriority, setSortByPriority] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  // ESTADOS (Solo para uso del Agente según HU-007)
const [historialSelected, setHistorialSelected] = useState<any[]>([]);
const [showHistorialId, setShowHistorialId] = useState<number | null>(null);
const [loadingHistorial, setLoadingHistorial] = useState(false);

// ESTADO MODAL REAPERTURA (HU-019)
const [reopenTicket, setReopenTicket] = useState<Ticket | null>(null);

// ESTADOS DE COMENTARIOS
const [showCommentsId, setShowCommentsId] = useState<number | null>(null);
const [comentarios, setComentarios] = useState<Comment[]>([]);
const [loadingComentarios, setLoadingComentarios] = useState(false);
const [nuevoComentario, setNuevoComentario] = useState<{ [key: number]: string }>({});
const [errorComentario, setErrorComentario] = useState<{ [key: number]: string }>({});
const [enviandoComentario, setEnviandoComentario] = useState(false);

// FUNCIONES DE COMENTARIOS
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

// FUNCIÓN DE CARGA
const verHistorial = async (ticketId: number) => {
  if (showHistorialId === ticketId) {
    setShowHistorialId(null);
    return;
  }
  try {
    setLoadingHistorial(true);
    const data = await ticketService.getTicketHistory(ticketId);
    setHistorialSelected(data);
    setShowHistorialId(ticketId);
  } catch (err) {
    console.error("Error al cargar historial");
  } finally {
    setLoadingHistorial(false);
  }
};

  const navigate = useNavigate();

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate("/");
    } else {
      const userData = authService.getCurrentUser();
      setUser(userData);
      cargarTickets();
    }
  }, [navigate]);

  // Refrescar tickets cada 5 segundos (solo si no hay búsqueda activa)
  useEffect(() => {
    if (user && !filtroBusqueda) {
      const interval = setInterval(() => {
        cargarTickets();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user, filtroBusqueda]);

  const cargarTickets = async () => {
    try {
      const miTickets = await ticketService.getMyTickets();
      setTickets(miTickets);
    } catch (err: any) {
      console.error("Error cargando tickets:", err.message);
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
    await cargarTickets();
  };

  const crearTicket = async () => {
    if (!title || !description) {
      setError("Título y descripción son obligatorios");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await ticketService.createTicket(title, description, priority, type);
      alert("Ticket creado exitosamente");
      setTitle("");
      setDescription("");
      setPriority("Media");
      setType("Software");
      cargarTickets();
    } catch (err: any) {
      setError(err.message || "Error al crear ticket");
    } finally {
      setLoading(false);
    }
  };

  const cambiarEstado = async (ticketId: number, nuevoEstado: 'Abierto' | 'En progreso' | 'Cerrado') => {
    try {
      await ticketService.updateTicketStatus(ticketId, nuevoEstado, user.id);
      alert("Estado actualizado");
      cargarTickets();
    } catch (err: any) {
      alert("Error actualizando estado: " + err.message);
    }
  };

  const cambiarPrioridad = async (ticketId: number, newPriority: PrioridadTicket) => {
    try {
      await ticketService.updateTicketPriority(ticketId, newPriority);
      setPrioridadSeleccionada(prev => { const n = { ...prev }; delete n[ticketId]; return n; });
      cargarTickets();
    } catch (err: any) {
      alert("Error actualizando prioridad: " + err.message);
    }
  };

  // Paleta de colores para modo oscuro — debe estar ANTES de cualquier return
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const dk = {
    page:          isDark ? "#0f172a"   : "transparent",
    card:          isDark ? "#1e1e1e"   : "#fafafa",
    cardBorder:    isDark ? "#334155"   : "#e5e7eb",
    text:          isDark ? "#f5f5f5"   : "#1f2937",
    textSub:       isDark ? "#aaaaaa"   : "#666",
    label:         isDark ? "#aaaaaa"   : "#374151",
    panelEstado:   isDark ? "#1a1f10"   : "#fff",
    labelEstado:   isDark ? "#fbbf24"   : "#374151",
    panelPriority: isDark ? "#2a1f18"   : "#fff7ed",
    labelPriority: isDark ? "#fb923c"   : "#9a3412",
    input:         isDark ? "#0f172a"   : "white",
    inputBorder:   isDark ? "#475569"   : "#d1d5db",
    divider:       isDark ? "#334155"   : "#f3f4f6",
    expanded:      isDark ? "#121212"   : "#ffffff",
    expandedBorder:isDark ? "#334155"   : "#e5e7eb",
    histBtn:       isDark ? "#93c5fd"   : "#2563eb",
    commentBtn:    isDark ? "#c4b5fd"   : "#7c3aed",
  };

  if (!user) return null;

  // VISTA CLIENTE
  if (user.role === "cliente") {
    return (
      <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>

      {/* MODAL REAPERTURA */}
      {reopenTicket && (
        <ReopenModal
          ticket={reopenTicket}
          userRole={user.role}
          onConfirm={async (motivo) => {
            await ticketService.reopenTicket(reopenTicket.id, motivo);
            setReopenTicket(null);
            await cargarTickets();
          }}
          onClose={() => setReopenTicket(null)}
        />
      )}
        
        <button 
          onClick={() => navigate("/dashboard")}
          style={{ 
            backgroundColor: "#6b7280", 
            color: "white", 
            padding: "8px 16px", 
            border: "none", 
            borderRadius: "4px", 
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold",
            marginBottom: "20px"
          }}
        >
          ← Volver
        </button>

        <div style={{ 
          backgroundColor: "white",
          border: "2px solid #3b82f6",
          borderRadius: "8px",
          padding: "25px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          marginBottom: "30px"
        }}>
          <h2 style={{ color: "#3b82f6", marginTop: "0" }}>Crear Nuevo Ticket</h2>
          <p style={{ color: "#666", marginBottom: "20px" }}>Completa el formulario para crear un nuevo ticket</p>

          {error && <p style={{ color: 'red' }}>{error}</p>}

          <input 
            placeholder="Título del ticket"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
            style={{ width: "100%", padding: "10px", marginBottom: "15px", border: "1px solid #ddd", borderRadius: "4px", boxSizing: "border-box" }}
          />

          <textarea 
            placeholder="Descripción detallada"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            style={{ width: "100%", padding: "10px", marginBottom: "15px", border: "1px solid #ddd", borderRadius: "4px", boxSizing: "border-box", minHeight: "120px" }}
          />

          <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={loading}
              style={{ flex: 1, padding: "10px", border: "1px solid #ddd", borderRadius: "4px", color: "#1f2937", backgroundColor: "white" }}
            >
              <option value="Software">Software</option>
              <option value="Hardware">Hardware</option>
              <option value="Red">Red</option>
              <option value="Acceso">Acceso</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <button 
            onClick={crearTicket}
            disabled={loading}
            style={{ 
              backgroundColor: "#3b82f6", 
              color: "white", 
              padding: "12px 24px", 
              border: "none", 
              borderRadius: "4px", 
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "bold"
            }}
          >
            {loading ? "Creando..." : "Crear Ticket"}
          </button>
        </div>

        {/* BARRA DE BÚSQUEDA */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "15px", alignItems: "center" }}>
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
          <p style={{ color: "#6b7280", fontSize: "13px", marginBottom: "10px" }}>
            Resultados para: <strong>"{filtroBusqueda}"</strong> ({tickets.length} encontrado{tickets.length !== 1 ? "s" : ""})
          </p>
        )}

        {/* MIS TICKETS */}
        <h3>Mis Tickets ({tickets.length})</h3>
        {tickets.length === 0 ? (
          <p style={{ color: "#666", textAlign: "center", padding: "20px" }}>No tienes tickets creados aún</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {tickets.map((ticket) => (
              <div key={ticket.id} style={{ 
                border: "1px solid #e5e7eb",
                borderRadius: "6px", 
                padding: "15px",
                backgroundColor: "#fafafa"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 5px 0", color: "#1f2937" }}>{ticket.title}</h4>
                    <p style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#666" }}>{ticket.description}</p>
                    <div style={{ display: "flex", gap: "10px", fontSize: "13px", color: "#666", flexWrap: "wrap", alignItems: "center" }}>
                      <span>Estado: <strong>{ticket.status}</strong></span>
                      <span style={{
                        padding: "2px 10px",
                        borderRadius: "12px",
                        fontWeight: "bold",
                        fontSize: "12px",
                        backgroundColor: ticket.priority === "Alta" ? "#fee2e2" : ticket.priority === "Media" ? "#fef3c7" : "#dcfce7",
                        color: ticket.priority === "Alta" ? "#991b1b" : ticket.priority === "Media" ? "#92400e" : "#166534"
                      }}>
                        {ticket.priority}
                      </span>
                      <span>Tipo: <strong>{ticket.type}</strong></span>
                    </div>
                  </div>
                </div>

                {/* BOTÓN REABRIR TICKET (HU-019) – solo si está cerrado */}
                {ticket.status === "Cerrado" && (
                  <div style={{ marginTop: "10px" }}>
                    <button
                      onClick={() => setReopenTicket(ticket)}
                      style={{
                        backgroundColor: "#6366f1", color: "white",
                        padding: "7px 16px", border: "none", borderRadius: "6px",
                        cursor: "pointer", fontSize: "13px", fontWeight: "bold"
                      }}
                    >
                      🔄 Reabrir Ticket
                    </button>
                  </div>
                )}

                {/* SECCIÓN DE COMENTARIOS */}
                <div style={{ marginTop: "12px", borderTop: "1px dashed #d1d5db", paddingTop: "10px" }}>
                  <button
                    onClick={() => verComentarios(ticket.id)}
                    style={{ background: "none", border: "none", color: "#7c3aed", fontSize: "13px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", padding: "0" }}
                  >
                    {showCommentsId === ticket.id ? "▲ Ocultar Comentarios" : "▼ Ver Comentarios"}
                    {loadingComentarios && showCommentsId === ticket.id && " (Cargando...)"}
                  </button>

                  {showCommentsId === ticket.id && (
                    <div style={{ marginTop: "10px", backgroundColor: "#fff", padding: "12px", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
                      {comentarios.length === 0 ? (
                        <p style={{ fontSize: "12px", color: "#6b7280", textAlign: "center", margin: "0 0 10px 0" }}>Sin comentarios aún. ¡Sé el primero!</p>
                      ) : (
                        <div style={{ marginBottom: "12px", maxHeight: "220px", overflowY: "auto" }}>
                          {comentarios.map((c) => (
                            <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "bold", color: "#374151" }}>{c.autor}</span>
                                <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                                  {new Date(c.created_at).toLocaleString('es-ES', { hour12: false })}
                                </span>
                              </div>
                              <p style={{ margin: "0", fontSize: "13px", color: "#4b5563" }}>{c.content}</p>
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
            ))}
          </div>
        )}
      </div>
    );
  }

  // VISTA AGENTE
  if (user.role === "agente") {
    return (
      <div style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>

      {/* MODAL REAPERTURA */}
      {reopenTicket && (
        <ReopenModal
          ticket={reopenTicket}
          userRole={user.role}
          onConfirm={async (motivo) => {
            await ticketService.reopenTicket(reopenTicket.id, motivo);
            setReopenTicket(null);
            await cargarTickets();
          }}
          onClose={() => setReopenTicket(null)}
        />
      )}
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h1 style={{ margin: "0" }}>Mis Tickets Asignados</h1>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setSortByPriority(s => !s)}
              style={{
                backgroundColor: sortByPriority ? "#6366f1" : "#e5e7eb",
                color: sortByPriority ? "white" : "#374151",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold"
              }}
            >
              ↕ {sortByPriority ? "Orden: Prioridad" : "Ordenar por Prioridad"}
            </button>
            <button
              onClick={() => cargarTickets()}
              style={{ backgroundColor: "#10b981", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "14px", fontWeight: "bold" }}
            >
              🔄 Refrescar
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              style={{ backgroundColor: "#6b7280", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "14px", fontWeight: "bold" }}
            >
              ← Volver
            </button>
          </div>
        </div>

        {/* BARRA DE BÚSQUEDA */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", alignItems: "center" }}>
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
          <p style={{ color: "#6b7280", fontSize: "13px", marginBottom: "10px" }}>
            Resultados para: <strong>"{filtroBusqueda}"</strong> ({tickets.length} encontrado{tickets.length !== 1 ? "s" : ""})
          </p>
        )}

        {tickets.length === 0 ? (
          <p style={{ color: "#666", textAlign: "center", padding: "20px" }}>
            {filtroBusqueda
              ? `No se encontraron tickets con "${filtroBusqueda}"`
              : "No tienes tickets asignados"}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {(sortByPriority
              ? [...tickets].sort((a, b) => (PRIORIDAD_ORDEN[a.priority] ?? 4) - (PRIORIDAD_ORDEN[b.priority] ?? 4))
              : tickets
            ).map((ticket) => (
              <div key={ticket.id} style={{
                border: `3px solid ${dk.cardBorder}`,
                borderRadius: "6px",
                padding: "15px",
                backgroundColor: dk.card
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 5px 0", color: dk.text }}>{ticket.title}</h3>
                    <p style={{ margin: "0 0 10px 0", fontSize: "14px", color: dk.textSub }}>{ticket.description}</p>
                    <div style={{ display: "flex", gap: "10px", fontSize: "13px", color: dk.textSub, flexWrap: "wrap", alignItems: "center" }}>
                      <span>Estado: <strong>{ticket.status}</strong></span>
                      <span
                        style={{
                          padding: "2px 10px",
                          borderRadius: "12px",
                          fontWeight: "bold",
                          fontSize: "12px",
                          backgroundColor: ticket.priority === "Alta" ? "#fee2e2" : ticket.priority === "Media" ? "#fef3c7" : "#dcfce7",
                          color: ticket.priority === "Alta" ? "#991b1b" : ticket.priority === "Media" ? "#92400e" : "#166534"
                        }}
                      >
                        {ticket.priority}
                      </span>
                      <span>Tipo: <strong>{ticket.type}</strong></span>
                      <span>Creado: <strong>{new Date(ticket.created_at).toLocaleDateString()}</strong></span>
                    </div>
                  </div>
                </div>

                {/* CAMBIAR ESTADO */}
                <div style={{ backgroundColor: dk.panelEstado, padding: "12px", borderRadius: "4px", marginTop: "10px", borderLeft: "4px solid #f59e0b" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", color: dk.labelEstado, marginBottom: "8px" }}>
                    Cambiar Estado:
                  </label>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <select
                      onChange={(e) => setEstadoSeleccionado({...estadoSeleccionado, [ticket.id]: e.target.value})}
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
                      <option value="">Selecciona un estado...</option>
                      {ticket.status !== "Abierto" && <option value="Abierto">Abierto</option>}
                      {ticket.status !== "En progreso" && <option value="En progreso">En progreso</option>}
                      {ticket.status !== "Cerrado" && <option value="Cerrado">Cerrado</option>}
                    </select>
                    <button
                      onClick={() => {
                        const nuevoEstado = estadoSeleccionado[ticket.id] as 'Abierto' | 'En progreso' | 'Cerrado';
                        if (nuevoEstado) cambiarEstado(ticket.id, nuevoEstado);
                      }}
                      style={{
                        backgroundColor: "#f59e0b",
                        color: "white",
                        padding: "8px 16px",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "bold"
                      }}
                    >
                      Actualizar
                    </button>
                  </div>
                </div>

                {/* CAMBIAR PRIORIDAD */}
                <div style={{ backgroundColor: dk.panelPriority, padding: "12px", borderRadius: "4px", marginTop: "10px", borderLeft: "4px solid #f97316" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", color: dk.labelPriority, marginBottom: "8px" }}>
                    Cambiar Prioridad:
                  </label>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <select
                      value={prioridadSeleccionada[ticket.id] ?? ""}
                      onChange={(e) => setPrioridadSeleccionada(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                      style={{ padding: "8px", border: `1px solid ${dk.inputBorder}`, borderRadius: "4px", fontSize: "13px", flex: 1, backgroundColor: dk.input, color: dk.text }}
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
                        backgroundColor: prioridadSeleccionada[ticket.id] ? "#f97316" : "#d1d5db",
                        color: "white",
                        padding: "8px 16px",
                        border: "none",
                        borderRadius: "4px",
                        cursor: prioridadSeleccionada[ticket.id] ? "pointer" : "not-allowed",
                        fontSize: "13px",
                        fontWeight: "bold"
                      }}
                    >
                      Actualizar
                    </button>
                  </div>
                </div>

              {/* BOTÓN REABRIR TICKET (HU-019) – solo si está cerrado */}
              {ticket.status === "Cerrado" && (
                <div style={{ marginTop: "12px" }}>
                  <button
                    onClick={() => setReopenTicket(ticket)}
                    style={{
                      backgroundColor: "#6366f1", color: "white",
                      padding: "7px 16px", border: "none", borderRadius: "6px",
                      cursor: "pointer", fontSize: "13px", fontWeight: "bold"
                    }}
                  >
                    🔄 Reabrir Ticket
                  </button>
                </div>
              )}

              {/* --- SECCIÓN DE HISTORIAL PARA EL AGENTE (HU-007) --- */}
<div style={{ marginTop: "15px", borderTop: `1px dashed ${dk.divider}`, paddingTop: "10px" }}>
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
      gap: "5px",
      padding: "0"
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

              {/* --- SECCIÓN DE COMENTARIOS (AGENTE) --- */}
              <div style={{ marginTop: "10px", borderTop: `1px dashed ${dk.divider}`, paddingTop: "10px" }}>
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
                      <p style={{ fontSize: "12px", color: dk.textSub, textAlign: "center", margin: "0 0 10px 0" }}>Sin comentarios aún. ¡Sé el primero!</p>
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
                        style={{ width: "100%", padding: "8px", border: `1px solid ${dk.inputBorder}`, borderRadius: "4px", fontSize: "13px", resize: "vertical", minHeight: "60px", boxSizing: "border-box", backgroundColor: dk.input, color: dk.text }}
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
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default Tickets;
