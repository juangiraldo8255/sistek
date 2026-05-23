import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ticketService, Ticket, PRIORIDADES, PrioridadTicket, PRIORIDAD_ORDEN } from "../services/ticketService";
import { commentService, Comment } from "../services/commentService";
import { ratingService, Rating } from "../services/ratingService";
import { authService } from "../services/authService";
import { useTheme } from "../context/ThemeContext";
import ReopenModal from "../components/ReopenModal";
import AttachmentSection from "../components/AttachmentSection";
import "../styles.css";

function Tickets() {

  // Tracking de IDs de tickets cerrados ya cargados para evitar N+1 en el polling
  const loadedRatingIds = useRef<Set<number>>(new Set());

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

// ESTADOS DE CALIFICACIÓN (HU-021)
const [ratings, setRatings] = useState<{ [ticketId: number]: Rating | null }>({});
const [showRatingId, setShowRatingId] = useState<number | null>(null);
const [ratingPuntuacion, setRatingPuntuacion] = useState<{ [ticketId: number]: number }>({});
const [ratingComentario, setRatingComentario] = useState<{ [ticketId: number]: string }>({});
const [ratingError, setRatingError] = useState<{ [ticketId: number]: string }>({});
const [ratingSuccess, setRatingSuccess] = useState<{ [ticketId: number]: boolean }>({});
const [enviandoRating, setEnviandoRating] = useState(false);

const EXPIRY_DAYS = 7;

const isRatingExpired = (ticket: Ticket): boolean => {
  if (ticket.status !== "Cerrado") return false;
  const closedAt = new Date(ticket.updated_at);
  const diffDays = (Date.now() - closedAt.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > EXPIRY_DAYS;
};

const cargarRatings = async (cerrados: Ticket[]) => {
  // Solo cargar tickets cuya calificación no haya sido pedida antes.
  // Esto evita N peticiones por ciclo en el polling de 5 s.
  const nuevos = cerrados.filter(t => !loadedRatingIds.current.has(t.id));
  if (nuevos.length === 0) return;

  const map: { [id: number]: Rating | null } = {};
  await Promise.all(
    nuevos.map(async (t) => {
      try {
        map[t.id] = await ratingService.getRating(t.id);
        loadedRatingIds.current.add(t.id);
      } catch {
        map[t.id] = null;
      }
    })
  );
  setRatings(prev => ({ ...prev, ...map }));
};

const enviarRating = async (ticketId: number) => {
  const puntuacion = ratingPuntuacion[ticketId];
  if (!puntuacion || puntuacion < 1 || puntuacion > 5) {
    setRatingError(prev => ({ ...prev, [ticketId]: "Debes seleccionar una puntuación del 1 al 5" }));
    return;
  }
  try {
    setEnviandoRating(true);
    setRatingError(prev => ({ ...prev, [ticketId]: "" }));
    const rating = await ratingService.rateTicket(ticketId, puntuacion, ratingComentario[ticketId]);
    setRatings(prev => ({ ...prev, [ticketId]: rating }));
    setRatingSuccess(prev => ({ ...prev, [ticketId]: true }));
    setShowRatingId(null);
  } catch (err: any) {
    setRatingError(prev => ({ ...prev, [ticketId]: err.message }));
  } finally {
    setEnviandoRating(false);
  }
};

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
      const userData = authService.getCurrentUser();
      if (userData?.role === "cliente") {
        const cerrados = miTickets.filter(t => t.status === "Cerrado");
        await cargarRatings(cerrados);
      }
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
      await cargarTickets();
      alert("Estado actualizado exitosamente");
      // Si el historial de este ticket está abierto, refrescarlo automáticamente
      if (showHistorialId === ticketId) {
        const data = await ticketService.getTicketHistory(ticketId);
        setHistorialSelected(data);
      }
    } catch (err: any) {
      alert("Error actualizando estado: " + err.message);
    }
  };

  const cambiarPrioridad = async (ticketId: number, newPriority: PrioridadTicket) => {
    try {
      await ticketService.updateTicketPriority(ticketId, newPriority);
      setPrioridadSeleccionada(prev => { const n = { ...prev }; delete n[ticketId]; return n; });
      await cargarTickets();
      alert("Cambio de prioridad exitoso");
      // Si el historial de este ticket está abierto, refrescarlo automáticamente
      if (showHistorialId === ticketId) {
        const data = await ticketService.getTicketHistory(ticketId);
        setHistorialSelected(data);
      }
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

  // Design helpers
  const getPriorityBorder = (p: string) =>
    p === "Alta" ? "#ef4444" : p === "Media" ? "#f59e0b" : "#10b981";

  const getPriorityBadge = (p: string) => ({
    bg: p === "Alta" ? "#fee2e2" : p === "Media" ? "#fef3c7" : "#dcfce7",
    color: p === "Alta" ? "#991b1b" : p === "Media" ? "#92400e" : "#166534",
  });

  const getStatusBadge = (s: string) => ({
    bg: s === "Cerrado" ? "#dcfce7" : s === "En progreso" ? "#dbeafe" : "#fef9c3",
    color: s === "Cerrado" ? "#166534" : s === "En progreso" ? "#1d4ed8" : "#92400e",
  });

  if (!user) return null;

  // VISTA CLIENTE
  if (user.role === "cliente") {
    return (
      <div style={{ minHeight: "100vh", background: isDark ? "#0f172a" : "#f0f4ff", padding: "24px" }}>

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

        <div style={{ maxWidth: "900px", margin: "0 auto" }}>

          {/* HEADER BANNER */}
          <div style={{
            background: isDark
              ? "linear-gradient(135deg,#1e293b,#1e1e2e)"
              : "linear-gradient(135deg,#2563eb,#6366f1)",
            borderRadius: "16px",
            padding: "24px 28px",
            marginBottom: "24px",
            boxShadow: "0 4px 20px rgba(37,99,235,0.25)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: "12px"
          }}>
            <div>
              <h1 style={{ color: "white", margin: 0, fontSize: "22px", fontWeight: "700" }}>
                🎫 Mis Tickets
              </h1>
              <p style={{ color: "rgba(255,255,255,0.8)", margin: "4px 0 0 0", fontSize: "14px" }}>
                Gestiona y crea tus tickets de soporte
              </p>
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                background: "rgba(255,255,255,0.15)",
                color: "white",
                padding: "8px 18px",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                width: "auto", marginTop: "0",
              }}
            >
              ← Volver
            </button>
          </div>

          {/* FORMULARIO CREAR TICKET */}
          <div style={{
            background: isDark ? "#1e293b" : "white",
            borderRadius: "14px",
            boxShadow: isDark
              ? "0 0 0 1px #334155, 0 4px 20px rgba(0,0,0,0.3)"
              : "0 4px 20px rgba(0,0,0,0.08)",
            marginBottom: "24px",
            overflow: "hidden",
          }}>
            <div style={{
              background: isDark ? "rgba(37,99,235,0.12)" : "#eff6ff",
              borderBottom: `1px solid ${isDark ? "#334155" : "#bfdbfe"}`,
              padding: "18px 24px",
            }}>
              <h2 style={{ margin: 0, color: isDark ? "#93c5fd" : "#2563eb", fontSize: "18px", fontWeight: "700" }}>
                ✏️ Crear Nuevo Ticket
              </h2>
              <p style={{ margin: "4px 0 0 0", color: dk.textSub, fontSize: "13px" }}>
                Completa el formulario para reportar un problema de soporte
              </p>
            </div>

            <div style={{ padding: "24px" }}>
              {error && (
                <div style={{
                  background: "#fee2e2", border: "1px solid #fca5a5",
                  borderRadius: "8px", padding: "10px 14px",
                  color: "#991b1b", fontSize: "13px", marginBottom: "16px",
                }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: dk.label, marginBottom: "6px" }}>
                  📌 Título del ticket
                </label>
                <input
                  placeholder="Título del ticket"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={loading}
                  style={{
                    width: "100%", padding: "10px 14px",
                    border: `1px solid ${dk.inputBorder}`,
                    borderRadius: "8px", fontSize: "14px",
                    backgroundColor: dk.input, color: dk.text,
                    boxSizing: "border-box", outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: dk.label, marginBottom: "6px" }}>
                  📝 Descripción
                </label>
                <textarea
                  placeholder="Descripción detallada del problema"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                  style={{
                    width: "100%", padding: "10px 14px",
                    border: `1px solid ${dk.inputBorder}`,
                    borderRadius: "8px", fontSize: "14px",
                    resize: "vertical", minHeight: "110px",
                    backgroundColor: dk.input, color: dk.text,
                    boxSizing: "border-box", outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: dk.label, marginBottom: "6px" }}>
                  🏷️ Tipo
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  disabled={loading}
                  style={{
                    width: "100%", padding: "10px 14px",
                    border: `1px solid ${dk.inputBorder}`,
                    borderRadius: "8px", fontSize: "14px",
                    backgroundColor: dk.input, color: dk.text,
                    cursor: "pointer",
                  }}
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
                  background: loading
                    ? "#94a3b8"
                    : "linear-gradient(135deg,#2563eb,#6366f1)",
                  color: "white",
                  padding: "11px 28px",
                  border: "none",
                  borderRadius: "10px",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: "15px",
                  fontWeight: "700",
                  boxShadow: loading ? "none" : "0 4px 12px rgba(37,99,235,0.4)",
                  width: "auto", marginTop: "0",
                }}
              >
                {loading ? "⏳ Creando..." : "🚀 Crear Ticket"}
              </button>
            </div>
          </div>

          {/* BARRA DE BÚSQUEDA */}
          <div style={{
            background: isDark ? "#1e293b" : "white",
            borderRadius: "12px",
            padding: "10px 14px",
            marginBottom: "16px",
            boxShadow: isDark
              ? "0 0 0 1px #334155, 0 2px 8px rgba(0,0,0,0.2)"
              : "0 2px 8px rgba(0,0,0,0.06)",
            display: "flex", gap: "8px", alignItems: "center",
          }}>
            <span style={{ fontSize: "16px", flexShrink: 0, color: "#94a3b8" }}>🔍</span>
            <input
              type="text"
              placeholder="Buscar por título o descripción..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && realizarBusqueda()}
              style={{
                flex: 1, border: `1px solid ${dk.inputBorder}`, outline: "none",
                fontSize: "14px", backgroundColor: dk.input, color: dk.text,
                padding: "7px 10px", borderRadius: "6px",
                width: "auto", marginTop: "0", boxSizing: "border-box",
              }}
            />
            <button
              onClick={realizarBusqueda}
              style={{
                background: "linear-gradient(135deg,#2563eb,#6366f1)",
                color: "white", padding: "7px 16px",
                border: "none", borderRadius: "8px",
                cursor: "pointer", fontSize: "13px", fontWeight: "600",
                flexShrink: 0, width: "auto", marginTop: "0",
              }}
            >
              Buscar
            </button>
            {filtroBusqueda && (
              <button
                onClick={limpiarBusqueda}
                style={{
                  backgroundColor: isDark ? "#334155" : "#f1f5f9",
                  color: isDark ? "#f1f5f9" : "#374151",
                  padding: "7px 12px", border: "none",
                  borderRadius: "8px", cursor: "pointer",
                  fontSize: "13px", flexShrink: 0,
                  width: "auto", marginTop: "0",
                }}
              >
                ✕ Limpiar
              </button>
            )}
          </div>

          {filtroBusqueda && (
            <p style={{ color: dk.textSub, fontSize: "13px", marginBottom: "12px" }}>
              Resultados para: <strong>"{filtroBusqueda}"</strong> — {tickets.length} encontrado{tickets.length !== 1 ? "s" : ""}
            </p>
          )}

          {/* CABECERA LISTADO */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, color: dk.text, fontSize: "16px", fontWeight: "700" }}>🎫 Mis Tickets</h3>
            <span style={{
              background: isDark ? "#334155" : "#e0e7ff",
              color: isDark ? "#93c5fd" : "#3730a3",
              borderRadius: "20px", padding: "2px 10px",
              fontSize: "13px", fontWeight: "700",
            }}>
              {tickets.length}
            </span>
          </div>

          {tickets.length === 0 ? (
            <div style={{
              background: isDark ? "#1e293b" : "white",
              borderRadius: "14px", padding: "48px 24px",
              textAlign: "center",
              boxShadow: isDark ? "0 0 0 1px #334155" : "0 2px 8px rgba(0,0,0,0.06)",
              color: dk.textSub,
            }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📭</div>
              <p style={{ margin: 0, fontSize: "15px" }}>No tienes tickets creados aún</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {tickets.map((ticket) => {
                const pBadge = getPriorityBadge(ticket.priority);
                const sBadge = getStatusBadge(ticket.status);
                return (
                  <div key={ticket.id} style={{
                    background: isDark ? "#1e293b" : "white",
                    borderRadius: "14px",
                    boxShadow: isDark
                      ? "0 0 0 1px #334155, 0 2px 12px rgba(0,0,0,0.3)"
                      : "0 2px 12px rgba(0,0,0,0.08)",
                    overflow: "hidden",
                    borderLeft: `5px solid ${getPriorityBorder(ticket.priority)}`,
                  }}>
                    <div style={{ padding: "18px 20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                        <h4 style={{ margin: 0, color: dk.text, fontSize: "15px", fontWeight: "700", flex: 1, marginRight: "12px" }}>
                          {ticket.title}
                        </h4>
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0, flexWrap: "wrap" }}>
                          <span style={{
                            padding: "3px 10px", borderRadius: "20px",
                            fontSize: "11px", fontWeight: "700",
                            backgroundColor: sBadge.bg, color: sBadge.color,
                          }}>{ticket.status}</span>
                          <span style={{
                            padding: "3px 10px", borderRadius: "20px",
                            fontSize: "11px", fontWeight: "700",
                            backgroundColor: pBadge.bg, color: pBadge.color,
                          }}>{ticket.priority}</span>
                        </div>
                      </div>
                      <p style={{ margin: "0 0 10px 0", fontSize: "14px", color: dk.textSub, lineHeight: "1.5" }}>
                        {ticket.description}
                      </p>
                      <div style={{ display: "flex", gap: "14px", fontSize: "12px", color: dk.textSub, flexWrap: "wrap" }}>
                        <span>🏷️ <strong>{ticket.type}</strong></span>
                      </div>
                    </div>

                    {/* BOTÓN REABRIR TICKET (HU-019) */}
                    {ticket.status === "Cerrado" && (
                      <div style={{ padding: "0 20px 14px" }}>
                        <button
                          onClick={() => setReopenTicket(ticket)}
                          style={{
                            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                            color: "white",
                            padding: "7px 16px", border: "none", borderRadius: "8px",
                            cursor: "pointer", fontSize: "13px", fontWeight: "600",
                            boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
                            width: "auto", marginTop: "0",
                          }}
                        >
                          🔄 Reabrir Ticket
                        </button>
                      </div>
                    )}

                    {/* CALIFICACIÓN (HU-021) – solo si está cerrado */}
                    {ticket.status === "Cerrado" && (
                      <div style={{ borderTop: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`, padding: "14px 20px" }}>
                        {/* Ya calificado */}
                        {ratings[ticket.id] ? (
                          <div style={{
                            background: isDark ? "#162032" : "#f0fdf4",
                            border: `1px solid ${isDark ? "#1e4a2e" : "#86efac"}`,
                            borderRadius: "8px", padding: "10px 14px",
                            display: "flex", alignItems: "center", gap: "10px",
                          }}>
                            <span style={{ fontSize: "18px" }}>
                              {[1,2,3,4,5].map(s => (
                                <span key={s} style={{ color: s <= ratings[ticket.id]!.puntuacion ? "#f59e0b" : (isDark ? "#475569" : "#d1d5db") }}>★</span>
                              ))}
                            </span>
                            <span style={{ fontSize: "13px", color: isDark ? "#86efac" : "#166534" }}>
                              Calificaste este ticket con {ratings[ticket.id]!.puntuacion}/5
                              {ratings[ticket.id]!.comentario && ` · "${ratings[ticket.id]!.comentario}"`}
                            </span>
                          </div>
                        ) : isRatingExpired(ticket) ? (
                          /* Plazo expirado */
                          <div style={{
                            background: isDark ? "#1c1408" : "#fffbeb",
                            border: `1px solid ${isDark ? "#78350f" : "#fcd34d"}`,
                            borderRadius: "8px", padding: "10px 14px",
                            fontSize: "13px", color: isDark ? "#fcd34d" : "#92400e",
                          }}>
                            ⏰ El plazo para calificar este ticket ha expirado (más de {EXPIRY_DAYS} días desde el cierre).
                          </div>
                        ) : (
                          /* Formulario de calificación */
                          <>
                            <button
                              onClick={() => setShowRatingId(showRatingId === ticket.id ? null : ticket.id)}
                              style={{
                                background: isDark ? "#2d2a14" : "#fffbeb",
                                border: `1px solid ${isDark ? "#78350f" : "#fcd34d"}`,
                                color: isDark ? "#fbbf24" : "#d97706",
                                fontSize: "13px", fontWeight: "600",
                                cursor: "pointer", padding: "6px 14px",
                                borderRadius: "8px",
                                display: "flex", alignItems: "center", gap: "6px",
                                width: "auto", marginTop: "0",
                              }}
                            >
                              {showRatingId === ticket.id ? "▲ Ocultar calificación" : "⭐ Calificar atención"}
                            </button>

                            {showRatingId === ticket.id && (
                              <div style={{
                                marginTop: "12px",
                                background: isDark ? "#0f172a" : "#fafafa",
                                padding: "16px", borderRadius: "10px",
                                border: `1px solid ${dk.expandedBorder}`,
                              }}>
                                <p style={{ margin: "0 0 10px 0", fontSize: "13px", color: dk.label, fontWeight: "600" }}>
                                  ¿Cómo calificarías la atención recibida?
                                </p>

                                {/* Estrellas interactivas */}
                                <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                                  {[1,2,3,4,5].map(star => (
                                    <button
                                      key={star}
                                      onClick={() => setRatingPuntuacion(prev => ({ ...prev, [ticket.id]: star }))}
                                      style={{
                                        background: "none", border: "none",
                                        fontSize: "28px", cursor: "pointer", padding: "0",
                                        color: star <= (ratingPuntuacion[ticket.id] || 0) ? "#f59e0b" : (isDark ? "#475569" : "#d1d5db"),
                                        transition: "color 0.1s",
                                      }}
                                      title={`${star} estrella${star > 1 ? "s" : ""}`}
                                    >★</button>
                                  ))}
                                  {ratingPuntuacion[ticket.id] > 0 && (
                                    <span style={{ fontSize: "13px", color: dk.textSub, alignSelf: "center", marginLeft: "4px" }}>
                                      {ratingPuntuacion[ticket.id]}/5
                                    </span>
                                  )}
                                </div>

                                {/* Comentario opcional */}
                                <textarea
                                  value={ratingComentario[ticket.id] || ""}
                                  onChange={e => setRatingComentario(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                  placeholder="Comentario opcional (¿qué podemos mejorar?)"
                                  style={{
                                    width: "100%", padding: "8px",
                                    border: `1px solid ${dk.inputBorder}`,
                                    borderRadius: "8px", fontSize: "13px",
                                    resize: "vertical", minHeight: "56px",
                                    boxSizing: "border-box",
                                    backgroundColor: dk.input, color: dk.text,
                                  }}
                                />

                                {ratingError[ticket.id] && (
                                  <p style={{ fontSize: "12px", color: "#ef4444", margin: "6px 0 0 0" }}>
                                    {ratingError[ticket.id]}
                                  </p>
                                )}

                                <button
                                  onClick={() => enviarRating(ticket.id)}
                                  disabled={enviandoRating || !ratingPuntuacion[ticket.id]}
                                  style={{
                                    marginTop: "8px",
                                    background: (enviandoRating || !ratingPuntuacion[ticket.id])
                                      ? "#94a3b8"
                                      : "linear-gradient(135deg,#f59e0b,#d97706)",
                                    color: "white",
                                    padding: "8px 20px", border: "none",
                                    borderRadius: "8px",
                                    cursor: (enviandoRating || !ratingPuntuacion[ticket.id]) ? "not-allowed" : "pointer",
                                    fontSize: "13px", fontWeight: "700",
                                    boxShadow: (enviandoRating || !ratingPuntuacion[ticket.id])
                                      ? "none"
                                      : "0 2px 8px rgba(245,158,11,0.4)",
                                    width: "auto", marginTop: "0",
                                  }}
                                >
                                  {enviandoRating ? "Enviando..." : "Enviar calificación"}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* SECCIÓN DE COMENTARIOS */}
                    <div style={{ borderTop: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`, padding: "12px 20px" }}>
                      <button
                        onClick={() => verComentarios(ticket.id)}
                        style={{
                          background: "none", border: "none",
                          color: dk.commentBtn, fontSize: "13px", fontWeight: "600",
                          cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: "0",
                          width: "auto", marginTop: "0",
                        }}
                      >
                        {showCommentsId === ticket.id ? "▲ Ocultar Comentarios" : "💬 Ver Comentarios"}
                        {loadingComentarios && showCommentsId === ticket.id && " (Cargando...)"}
                      </button>

                      {showCommentsId === ticket.id && (
                        <div style={{ marginTop: "10px", background: dk.expanded, padding: "12px", borderRadius: "8px", border: `1px solid ${dk.expandedBorder}` }}>
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
                              style={{
                                width: "100%", padding: "8px",
                                border: `1px solid ${dk.inputBorder}`,
                                borderRadius: "6px", fontSize: "13px",
                                resize: "vertical", minHeight: "60px",
                                boxSizing: "border-box",
                                backgroundColor: dk.input, color: dk.text,
                              }}
                            />
                            <button
                              onClick={() => enviarComentario(ticket.id)}
                              disabled={enviandoComentario}
                              style={{
                                marginTop: "6px",
                                background: "linear-gradient(135deg,#7c3aed,#6366f1)",
                                color: "white", padding: "6px 16px",
                                border: "none", borderRadius: "6px",
                                cursor: "pointer", fontSize: "13px", fontWeight: "600",
                                boxShadow: "0 2px 6px rgba(124,58,237,0.35)",
                                width: "auto", marginTop: "0",
                              }}
                            >
                              {enviandoComentario ? "Enviando..." : "💬 Comentar"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ADJUNTOS (HU-020) */}
                    <div style={{ borderTop: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`, padding: "0 20px 16px" }}>
                      <AttachmentSection ticketId={ticket.id} userId={user.id} userRole={user.role} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // VISTA AGENTE
  if (user.role === "agente") {
    return (
      <div style={{ minHeight: "100vh", background: isDark ? "#0f172a" : "#f0f4ff", padding: "24px" }}>

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

        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>

          {/* HEADER BANNER */}
          <div style={{
            background: isDark
              ? "linear-gradient(135deg,#1e293b,#1e1e2e)"
              : "linear-gradient(135deg,#2563eb,#6366f1)",
            borderRadius: "16px",
            padding: "24px 28px",
            marginBottom: "24px",
            boxShadow: "0 4px 20px rgba(37,99,235,0.25)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: "12px",
          }}>
            <div>
              <h1 style={{ color: "white", margin: 0, fontSize: "22px", fontWeight: "700" }}>
                🎯 Mis Tickets Asignados
              </h1>
              <p style={{ color: "rgba(255,255,255,0.8)", margin: "4px 0 0 0", fontSize: "14px" }}>
                {tickets.length} ticket{tickets.length !== 1 ? "s" : ""} asignado{tickets.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => setSortByPriority(s => !s)}
                style={{
                  background: sortByPriority ? "rgba(99,102,241,0.9)" : "rgba(255,255,255,0.15)",
                  color: "white",
                  padding: "8px 16px",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  width: "auto", marginTop: "0",
                }}
              >
                ↕ {sortByPriority ? "Por Prioridad" : "Ordenar"}
              </button>
              <button
                onClick={() => cargarTickets()}
                style={{
                  background: "rgba(16,185,129,0.8)",
                  color: "white",
                  padding: "8px 16px",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  width: "auto", marginTop: "0",
                }}
              >
                🔄 Refrescar
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  color: "white",
                  padding: "8px 16px",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  width: "auto", marginTop: "0",
                }}
              >
                ← Volver
              </button>
            </div>
          </div>

          {/* BARRA DE BÚSQUEDA */}
          <div style={{
            background: isDark ? "#1e293b" : "white",
            borderRadius: "12px",
            padding: "10px 14px",
            marginBottom: "16px",
            boxShadow: isDark
              ? "0 0 0 1px #334155, 0 2px 8px rgba(0,0,0,0.2)"
              : "0 2px 8px rgba(0,0,0,0.06)",
            display: "flex", gap: "8px", alignItems: "center",
          }}>
            <span style={{ fontSize: "16px", flexShrink: 0, color: "#94a3b8" }}>🔍</span>
            <input
              type="text"
              placeholder="Buscar por título o descripción..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && realizarBusqueda()}
              style={{
                flex: 1, border: `1px solid ${dk.inputBorder}`, outline: "none",
                fontSize: "14px", backgroundColor: dk.input, color: dk.text,
                padding: "7px 10px", borderRadius: "6px",
                width: "auto", marginTop: "0", boxSizing: "border-box",
              }}
            />
            <button
              onClick={realizarBusqueda}
              style={{
                background: "linear-gradient(135deg,#2563eb,#6366f1)",
                color: "white", padding: "7px 16px",
                border: "none", borderRadius: "8px",
                cursor: "pointer", fontSize: "13px", fontWeight: "600",
                flexShrink: 0, width: "auto", marginTop: "0",
              }}
            >
              Buscar
            </button>
            {filtroBusqueda && (
              <button
                onClick={limpiarBusqueda}
                style={{
                  backgroundColor: isDark ? "#334155" : "#f1f5f9",
                  color: isDark ? "#f1f5f9" : "#374151",
                  padding: "7px 12px", border: "none",
                  borderRadius: "8px", cursor: "pointer",
                  fontSize: "13px", flexShrink: 0,
                  width: "auto", marginTop: "0",
                }}
              >
                ✕ Limpiar
              </button>
            )}
          </div>

          {filtroBusqueda && (
            <p style={{ color: dk.textSub, fontSize: "13px", marginBottom: "12px" }}>
              Resultados para: <strong>"{filtroBusqueda}"</strong> — {tickets.length} encontrado{tickets.length !== 1 ? "s" : ""}
            </p>
          )}

          {tickets.length === 0 ? (
            <div style={{
              background: isDark ? "#1e293b" : "white",
              borderRadius: "14px", padding: "48px 24px",
              textAlign: "center",
              boxShadow: isDark ? "0 0 0 1px #334155" : "0 2px 8px rgba(0,0,0,0.06)",
              color: dk.textSub,
            }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📭</div>
              <p style={{ margin: 0, fontSize: "15px" }}>
                {filtroBusqueda
                  ? `No se encontraron tickets con "${filtroBusqueda}"`
                  : "No tienes tickets asignados"}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {(sortByPriority
                ? [...tickets].sort((a, b) => (PRIORIDAD_ORDEN[a.priority] ?? 4) - (PRIORIDAD_ORDEN[b.priority] ?? 4))
                : tickets
              ).map((ticket) => {
                const pBadge = getPriorityBadge(ticket.priority);
                const sBadge = getStatusBadge(ticket.status);
                return (
                  <div key={ticket.id} style={{
                    background: isDark ? "#1e293b" : "white",
                    borderRadius: "14px",
                    boxShadow: isDark
                      ? "0 0 0 1px #334155, 0 2px 16px rgba(0,0,0,0.3)"
                      : "0 2px 16px rgba(0,0,0,0.08)",
                    overflow: "hidden",
                    borderLeft: `5px solid ${getPriorityBorder(ticket.priority)}`,
                  }}>
                    <div style={{ padding: "20px" }}>
                      {/* Ticket header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                        <h3 style={{ margin: 0, color: dk.text, fontSize: "16px", fontWeight: "700", flex: 1, marginRight: "12px" }}>
                          {ticket.title}
                        </h3>
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0, flexWrap: "wrap" }}>
                          <span style={{
                            padding: "3px 10px", borderRadius: "20px",
                            fontSize: "11px", fontWeight: "700",
                            backgroundColor: sBadge.bg, color: sBadge.color,
                          }}>{ticket.status}</span>
                          <span style={{
                            padding: "3px 10px", borderRadius: "20px",
                            fontSize: "11px", fontWeight: "700",
                            backgroundColor: pBadge.bg, color: pBadge.color,
                          }}>{ticket.priority}</span>
                        </div>
                      </div>
                      <p style={{ margin: "0 0 10px 0", fontSize: "14px", color: dk.textSub, lineHeight: "1.5" }}>
                        {ticket.description}
                      </p>
                      <div style={{ display: "flex", gap: "14px", fontSize: "12px", color: dk.textSub, flexWrap: "wrap" }}>
                        <span>🏷️ <strong>{ticket.type}</strong></span>
                        <span>📅 <strong>{new Date(ticket.created_at).toLocaleDateString()}</strong></span>
                      </div>

                      {/* CAMBIAR ESTADO */}
                      <div style={{
                        background: isDark ? "rgba(37,99,235,0.12)" : "#eff6ff",
                        borderRadius: "10px", padding: "14px 16px", marginTop: "14px",
                        border: `1px solid ${isDark ? "#2d4a8a" : "#bfdbfe"}`,
                        borderLeft: "4px solid #3b82f6",
                      }}>
                        <label style={{
                          display: "block", fontSize: "11px", fontWeight: "700",
                          color: isDark ? "#93c5fd" : "#2563eb",
                          marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px",
                        }}>
                          📋 Cambiar Estado
                        </label>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <select
                            onChange={(e) => setEstadoSeleccionado({...estadoSeleccionado, [ticket.id]: e.target.value})}
                            style={{
                              padding: "8px 12px",
                              border: `1px solid ${dk.inputBorder}`,
                              borderRadius: "8px",
                              fontSize: "13px",
                              cursor: "pointer",
                              flex: 1,
                              backgroundColor: dk.input,
                              color: dk.text,
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
                              background: "linear-gradient(135deg,#3b82f6,#2563eb)",
                              color: "white",
                              padding: "8px 18px",
                              border: "none",
                              borderRadius: "8px",
                              cursor: "pointer",
                              fontSize: "13px",
                              fontWeight: "700",
                              boxShadow: "0 2px 8px rgba(59,130,246,0.4)",
                              flexShrink: 0,
                              width: "auto", marginTop: "0",
                            }}
                          >
                            Actualizar
                          </button>
                        </div>
                      </div>

                      {/* CAMBIAR PRIORIDAD */}
                      <div style={{
                        background: isDark ? "#2a1f18" : "#fff7ed",
                        borderRadius: "10px", padding: "14px 16px", marginTop: "10px",
                        border: `1px solid ${isDark ? "#7c2d12" : "#fed7aa"}`,
                        borderLeft: "4px solid #f97316",
                      }}>
                        <label style={{
                          display: "block", fontSize: "11px", fontWeight: "700",
                          color: isDark ? "#fb923c" : "#ea580c",
                          marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px",
                        }}>
                          🎯 Cambiar Prioridad
                        </label>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <select
                            value={prioridadSeleccionada[ticket.id] ?? ""}
                            onChange={(e) => setPrioridadSeleccionada(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                            style={{
                              padding: "8px 12px",
                              border: `1px solid ${dk.inputBorder}`,
                              borderRadius: "8px", fontSize: "13px",
                              flex: 1, backgroundColor: dk.input, color: dk.text,
                            }}
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
                              background: prioridadSeleccionada[ticket.id]
                                ? "linear-gradient(135deg,#f97316,#ea580c)"
                                : "#d1d5db",
                              color: "white",
                              padding: "8px 18px",
                              border: "none",
                              borderRadius: "8px",
                              cursor: prioridadSeleccionada[ticket.id] ? "pointer" : "not-allowed",
                              fontSize: "13px",
                              fontWeight: "700",
                              boxShadow: prioridadSeleccionada[ticket.id]
                                ? "0 2px 8px rgba(249,115,22,0.4)"
                                : "none",
                              flexShrink: 0,
                              width: "auto", marginTop: "0",
                            }}
                          >
                            Actualizar
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* BOTÓN REABRIR TICKET (HU-019) */}
                    {ticket.status === "Cerrado" && (
                      <div style={{ padding: "0 20px 14px" }}>
                        <button
                          onClick={() => setReopenTicket(ticket)}
                          style={{
                            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                            color: "white",
                            padding: "7px 16px", border: "none", borderRadius: "8px",
                            cursor: "pointer", fontSize: "13px", fontWeight: "600",
                            boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
                            width: "auto", marginTop: "0",
                          }}
                        >
                          🔄 Reabrir Ticket
                        </button>
                      </div>
                    )}

                    {/* HISTORIAL (HU-007) */}
                    <div style={{ borderTop: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`, padding: "12px 20px" }}>
                      <button
                        onClick={() => verHistorial(ticket.id)}
                        style={{
                          background: isDark ? "#0f172a" : "#f8fafc",
                          border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                          color: dk.histBtn, fontSize: "13px", fontWeight: "600",
                          cursor: "pointer", padding: "6px 14px", borderRadius: "8px",
                          display: "flex", alignItems: "center", gap: "6px",
                          width: "auto", marginTop: "0",
                        }}
                      >
                        {showHistorialId === ticket.id ? "▲ Ocultar Actividad" : "📋 Ver Actividad Reciente"}
                        {loadingHistorial && showHistorialId === ticket.id && " (Cargando...)"}
                      </button>

                      {showHistorialId === ticket.id && (
                        <div style={{
                          marginTop: "10px",
                          background: dk.expanded,
                          padding: "10px", borderRadius: "8px",
                          border: `1px solid ${dk.expandedBorder}`,
                          maxHeight: "300px", overflowY: "auto",
                        }}>
                          {historialSelected.length === 0 ? (
                            <p style={{ fontSize: "12px", color: dk.textSub, textAlign: "center", margin: 0 }}>No hay registros aún.</p>
                          ) : (
                            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                              {historialSelected.map((h, index) => (
                                <li key={index} style={{
                                  fontSize: "12px", padding: "8px 0",
                                  borderBottom: index !== historialSelected.length - 1 ? `1px solid ${dk.divider}` : "none",
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

                    {/* COMENTARIOS (AGENTE) */}
                    <div style={{ borderTop: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`, padding: "12px 20px" }}>
                      <button
                        onClick={() => verComentarios(ticket.id)}
                        style={{
                          background: "none", border: "none",
                          color: dk.commentBtn, fontSize: "13px", fontWeight: "600",
                          cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: "0",
                          width: "auto", marginTop: "0",
                        }}
                      >
                        {showCommentsId === ticket.id ? "▲ Ocultar Comentarios" : "💬 Ver Comentarios"}
                        {loadingComentarios && showCommentsId === ticket.id && " (Cargando...)"}
                      </button>

                      {showCommentsId === ticket.id && (
                        <div style={{ marginTop: "10px", background: dk.expanded, padding: "12px", borderRadius: "8px", border: `1px solid ${dk.expandedBorder}` }}>
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
                              style={{
                                width: "100%", padding: "8px",
                                border: `1px solid ${dk.inputBorder}`,
                                borderRadius: "6px", fontSize: "13px",
                                resize: "vertical", minHeight: "60px",
                                boxSizing: "border-box",
                                backgroundColor: dk.input, color: dk.text,
                              }}
                            />
                            <button
                              onClick={() => enviarComentario(ticket.id)}
                              disabled={enviandoComentario}
                              style={{
                                marginTop: "6px",
                                background: "linear-gradient(135deg,#7c3aed,#6366f1)",
                                color: "white", padding: "6px 16px",
                                border: "none", borderRadius: "6px",
                                cursor: "pointer", fontSize: "13px", fontWeight: "600",
                                boxShadow: "0 2px 6px rgba(124,58,237,0.35)",
                                width: "auto", marginTop: "0",
                              }}
                            >
                              {enviandoComentario ? "Enviando..." : "💬 Comentar"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ADJUNTOS (HU-020) */}
                    <div style={{ borderTop: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`, padding: "0 20px 16px" }}>
                      <AttachmentSection ticketId={ticket.id} userId={user.id} userRole={user.role} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default Tickets;
