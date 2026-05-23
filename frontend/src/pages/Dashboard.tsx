import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ticketService, Ticket } from "../services/ticketService";
import { authService, User } from "../services/authService";
import NotificationBell from "../components/NotificationBell";
import { useTheme } from "../context/ThemeContext";

import "../styles.css";
import logo from "../Bienvenido.png";

function Dashboard() {

  const [user, setUser] = useState<any>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agentes, setAgentes] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // LÓGICA HU-008: Cálculo de Desempeño
  const calcularEstadisticas = () => {
    const cerrados = tickets.filter(t => t.status === 'Cerrado');
    let sumaHoras = 0;
    
    cerrados.forEach(t => {
      const creacion = new Date(t.created_at).getTime();
      const cierre = new Date(t.updated_at).getTime();
      sumaHoras += (cierre - creacion) / (1000 * 60 * 60);
    });

    const tiempoPromedio = cerrados.length > 0 ? (sumaHoras / cerrados.length).toFixed(1) : "0";
    
    const datosGrafica = agentes.map((agente: any) => ({
      nombre: agente.username,
      cantidad: tickets.filter(t => t.assigned_agent_id === agente.id && t.status === 'Cerrado').length
    }));

    return { tiempoPromedio, datosGrafica };
  };

  const stats = calcularEstadisticas();

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate("/");
    } else {
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);
      cargarDatos(currentUser);
    }
  }, [navigate]);

  const cargarDatos = async (currentUser: any) => {
    try {
      setLoading(true);

      // Cargar tickets según el rol
      if (currentUser.role === "cliente") {
        const miTickets = await ticketService.getMyTickets();
        setTickets(miTickets);
      } else if (currentUser.role === "agente") {
        const miTickets = await ticketService.getMyTickets();
        setTickets(miTickets);
      } else if (currentUser.role === "administrador") {
        const todosTickets = await ticketService.getAllTickets();
        setTickets(todosTickets);

        // Cargar agentes
        const listaAgentes = await authService.getAgents();
        setAgentes(listaAgentes);
      }
    } catch (err: any) {
      console.error("Error cargando datos:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    navigate("/");
  };

  const { theme, toggleTheme } = useTheme();
  const isDark    = theme === "dark";
  const axisColor = isDark ? "#aaaaaa" : "#6b7280";
  const gridColor = isDark ? "#334155" : "#e5e7eb";

  if (!user) return null;

  return (
    <div className="dashboard-container">

      {/* 🔵 SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-header">
          <img src={logo} alt="Sistek" />
          <span>SISTEK</span>
        </div>

        <button className="sidebar-nav-btn" onClick={() => navigate("/dashboard")}>🏠 Inicio</button>

        {user.role === "cliente" && (
          <button className="sidebar-nav-btn" onClick={() => navigate("/tickets")}>🎫 Crear Ticket</button>
        )}

        {user.role === "agente" && (
          <button className="sidebar-nav-btn" onClick={() => navigate("/tickets")}>🎫 Mis Tickets</button>
        )}

        {user.role === "administrador" && (
          <>
            <button className="sidebar-nav-btn" onClick={() => navigate("/admin-tickets")}>🎫 Todos los Tickets</button>
            <button className="sidebar-nav-btn" onClick={() => navigate("/reports")}>📊 Reportes</button>
          </>
        )}

        <button className="sidebar-nav-btn sidebar-theme-btn" onClick={toggleTheme}>
          {theme === "dark" ? "☀️ Modo Claro" : "🌙 Modo Oscuro"}
        </button>
        <button className="sidebar-logout-btn" onClick={logout}>🚪 Cerrar sesión</button>
      </div>

      {/* ⚪ CONTENIDO */}
      <div className="main-content">

        {/* ── BANNER DE BIENVENIDA ── */}
        <div style={{
          background: isDark
            ? 'linear-gradient(135deg, #1e293b 0%, #1e1e2e 100%)'
            : 'linear-gradient(135deg, #2563eb 0%, #6366f1 100%)',
          borderRadius: '16px',
          padding: '24px 28px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 20px rgba(37,99,235,0.25)'
        }}>
          <div>
            <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: 'rgba(255,255,255,0.75)', fontWeight: '500' }}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 style={{ margin: '0 0 10px 0', color: 'white', fontSize: '26px', fontWeight: '700' }}>
              👋 Bienvenido, {user.username}
            </h1>
            <span style={{
              display: 'inline-block',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'capitalize',
              backdropFilter: 'blur(4px)'
            }}>
              {user.role === 'administrador' ? '🛡️ Administrador'
                : user.role === 'agente' ? '🎧 Agente de Soporte'
                : '👤 Cliente'}
            </span>
          </div>
          {user.role === 'agente' && <NotificationBell />}
        </div>

        {/* ADMIN */}
        {user.role === "administrador" && (
          <>
          <div className="card" style={{ borderLeft: "5px solid #6366f1" }}>
            <h3 style={{ color: "#4f46e5", display: "flex", alignItems: "center", gap: "10px" }}>
              📊 Reporte de Desempeño (HU-008)
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "15px", marginBottom: "20px" }}>
              <div style={{ padding: "15px", backgroundColor: isDark ? "#1e1e1e" : "#f8fafc", borderRadius: "8px", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}` }}>
                <p style={{ fontSize: "12px", color: isDark ? "#aaaaaa" : "#64748b", margin: 0 }}>TIEMPO PROMEDIO</p>
                <h2 style={{ margin: "5px 0", color: isDark ? "#f5f5f5" : "#1e293b" }}>{stats.tiempoPromedio} <span style={{fontSize: "14px"}}>Hrs</span></h2>
              </div>
              <div style={{ padding: "15px", backgroundColor: isDark ? "#1e1e1e" : "#f8fafc", borderRadius: "8px", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}` }}>
                <p style={{ fontSize: "12px", color: isDark ? "#aaaaaa" : "#64748b", margin: 0 }}>TOTAL CERRADOS</p>
                <h2 style={{ margin: "5px 0", color: isDark ? "#f5f5f5" : "#1e293b" }}>{tickets.filter(t => t.status === 'Cerrado').length}</h2>
              </div>
            </div>

            <div style={{ height: "250px", width: "100%", marginTop: "10px" }}>
              <p style={{ fontSize: "13px", fontWeight: "bold", color: "#475569" }}>Tickets Cerrados por Agente</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.datosGrafica}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis dataKey="nombre" fontSize={11} tick={{ fill: axisColor }} axisLine={{ stroke: gridColor }} tickLine={{ stroke: gridColor }} />
                  <YAxis fontSize={11} tick={{ fill: axisColor }} axisLine={{ stroke: gridColor }} tickLine={{ stroke: gridColor }} />
                  <Tooltip contentStyle={{ backgroundColor: isDark ? "#1e293b" : "#fff", border: `1px solid ${gridColor}`, color: isDark ? "#f5f5f5" : "#374151" }} labelStyle={{ color: isDark ? "#f5f5f5" : "#374151" }} />
                  <Bar dataKey="cantidad" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
            {/* BOTONES DE ACCIÓN */}
            <div className="card">
              <h3>Gestión</h3>

              <button 
                onClick={() => navigate("/admin-tickets")}
                style={{ 
                  backgroundColor: "#3b82f6", 
                  color: "white", 
                  padding: "10px 16px", 
                  border: "none", 
                  borderRadius: "4px", 
                  cursor: "pointer",
                  marginBottom: "10px",
                  width: "100%",
                  fontSize: "14px",
                  fontWeight: "bold"
                }}
              >
                📋 Ver Todos los Tickets
              </button>
            </div>

            <div style={{ padding: "15px", backgroundColor: isDark ? "#1e1e1e" : "#f8fafc", borderRadius: "8px", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}` }}>
              <p style={{ fontSize: "12px", color: isDark ? "#aaaaaa" : "#64748b", margin: 0 }}>TOTAL CREADOS</p>
              <h2 style={{ margin: "5px 0", color: isDark ? "#f5f5f5" : "#1e293b" }}>{tickets.length}</h2>
            </div>

            {/* LISTADO DE AGENTES */}
            <div className="card">
              <h3>Agentes Disponibles ({agentes.length})</h3>

              {loading ? (
                <p>Cargando agentes...</p>
              ) : agentes.length === 0 ? (
                <p style={{ color: "#6b7280", textAlign: "center", padding: "20px" }}>
                  No hay agentes registrados aún
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "15px" }}>
                  {agentes.map((agente) => (
                    <div
                      key={agente.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "15px",
                        backgroundColor: "#f9fafb",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <div>
                        <h4 style={{ margin: "0 0 5px 0", color: "#1f2937", fontSize: "15px" }}>
                          {agente.username}
                        </h4>
                      </div>
                      <div
                        style={{
                          backgroundColor: "#d1fae5",
                          color: "#065f46",
                          padding: "6px 12px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "bold"
                        }}
                      >
                        Activo
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RESUMEN DE TICKETS */}
            <div className="card">
              <h3>Resumen de Tickets</h3>
              {loading ? (
                <p>Cargando...</p>
              ) : (
                <div>
                  <p><strong>Total:</strong> {tickets.length}</p>
                  <p><strong>Abiertos:</strong> {tickets.filter(t => t.status === 'Abierto').length}</p>
                  <p><strong>En progreso:</strong> {tickets.filter(t => t.status === 'En progreso').length}</p>
                  <p><strong>Cerrados:</strong> {tickets.filter(t => t.status === 'Cerrado').length}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* CLIENTE Y AGENTE — Mis Tickets */}
        {(user.role === "cliente" || user.role === "agente") && (
          <div className="card" style={{ borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>

            {/* Encabezado */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                🎫 Mis Tickets
              </h3>
              {tickets.length > 0 && (
                <span style={{
                  backgroundColor: isDark ? '#1e293b' : '#eff6ff',
                  color: '#2563eb',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: '1px solid #bfdbfe'
                }}>
                  {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b' }}>
              {user.role === "cliente" ? "Tickets que has creado" : "Tickets asignados a ti"}
            </p>

            {loading ? (
              <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>Cargando tickets...</p>
            ) : tickets.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "32px 20px",
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderRadius: "12px",
                border: `1.5px dashed ${isDark ? '#334155' : '#e2e8f0'}`
              }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div>
                <p style={{ margin: '0 0 14px 0', color: isDark ? '#94a3b8' : '#64748b', fontSize: '14px' }}>
                  {user.role === "cliente" ? "No tienes tickets creados aún" : "No hay tickets asignados"}
                </p>
                {user.role === "cliente" && (
                  <button
                    onClick={() => navigate("/tickets")}
                    style={{
                      backgroundColor: "#2563eb", color: "white",
                      padding: "10px 22px", border: "none", borderRadius: "10px",
                      cursor: "pointer", fontWeight: "600", fontSize: "14px",
                      boxShadow: "0 2px 8px rgba(37,99,235,0.3)"
                    }}
                  >
                    + Crear Ticket
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {tickets.slice(0, 5).map((ticket) => {
                  const statusColor =
                    ticket.status === 'Abierto'     ? { border: '#ef4444', bg: isDark ? '#2a1515' : '#fff5f5', badge: '#fee2e2', text: '#dc2626' } :
                    ticket.status === 'En progreso' ? { border: '#f59e0b', bg: isDark ? '#2a2010' : '#fffbeb', badge: '#fef3c7', text: '#d97706' } :
                                                      { border: '#10b981', bg: isDark ? '#0f2820' : '#f0fdf4', badge: '#dcfce7', text: '#059669' };
                  const prioColor =
                    ticket.priority === 'Alta'  ? { badge: '#fee2e2', text: '#dc2626' } :
                    ticket.priority === 'Media' ? { badge: '#fef3c7', text: '#d97706' } :
                                                  { badge: '#dcfce7', text: '#059669' };
                  return (
                    <div
                      key={ticket.id}
                      onClick={() => navigate('/tickets')}
                      style={{
                        borderLeft: `4px solid ${statusColor.border}`,
                        borderRadius: '10px',
                        padding: '14px 16px',
                        backgroundColor: statusColor.bg,
                        cursor: 'pointer',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                        border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
                        borderLeftColor: statusColor.border,
                        borderLeftWidth: '4px'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <h4 style={{ margin: '0 0 8px 0', color: isDark ? '#f1f5f9' : '#1f2937', fontSize: '14px', fontWeight: '600' }}>
                        #{ticket.id} — {ticket.title}
                      </h4>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          backgroundColor: statusColor.badge, color: statusColor.text,
                          padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700'
                        }}>
                          {ticket.status}
                        </span>
                        <span style={{
                          backgroundColor: prioColor.badge, color: prioColor.text,
                          padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700'
                        }}>
                          {ticket.priority}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {tickets.length > 5 && (
                  <p style={{ textAlign: 'center', fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', margin: '4px 0 0 0' }}>
                    +{tickets.length - 5} tickets más — <span
                      style={{ color: '#2563eb', cursor: 'pointer', fontWeight: '600' }}
                      onClick={() => navigate('/tickets')}
                    >ver todos</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}

export default Dashboard;
