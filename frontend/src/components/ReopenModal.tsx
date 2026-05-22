import { useState } from "react";
import { useTheme } from "../context/ThemeContext";

const DIAS_LIMITE = 30;

function diasDesde(fechaISO: string): number {
  return (Date.now() - new Date(fechaISO).getTime()) / (1000 * 60 * 60 * 24);
}

interface Props {
  ticket: { id: number; title: string; updated_at: string };
  userRole: string;
  onConfirm: (motivo: string) => Promise<void>;
  onClose: () => void;
}

export default function ReopenModal({ ticket, userRole, onConfirm, onClose }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const diasCerrado = diasDesde(ticket.updated_at);
  const plazoVencido = userRole === "cliente" && diasCerrado > DIAS_LIMITE;

  const handleConfirm = async () => {
    if (!motivo.trim()) {
      setError("El motivo es obligatorio para reabrir el ticket.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onConfirm(motivo.trim());
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px"
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: isDark ? "#1e293b" : "#ffffff",
          borderRadius: "10px",
          padding: "28px 32px",
          width: "100%", maxWidth: "500px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`
        }}
      >
        {/* Cabecera */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ fontSize: "20px" }}>🔄</span>
          <h3 style={{ margin: 0, color: isDark ? "#f1f5f9" : "#1e293b", fontSize: "18px" }}>
            Reabrir Ticket
          </h3>
        </div>
        <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: isDark ? "#94a3b8" : "#64748b" }}>
          #{ticket.id} – {ticket.title}
        </p>

        {/* Alerta de plazo vencido (solo clientes) */}
        {plazoVencido ? (
          <div style={{
            backgroundColor: isDark ? "#450a0a" : "#fef2f2",
            border: `1px solid ${isDark ? "#7f1d1d" : "#fecaca"}`,
            borderRadius: "8px", padding: "16px", marginBottom: "20px"
          }}>
            <p style={{ margin: "0 0 6px 0", fontWeight: "bold", color: isDark ? "#fca5a5" : "#991b1b", fontSize: "14px" }}>
              ⚠️ Plazo de reapertura vencido
            </p>
            <p style={{ margin: 0, color: isDark ? "#fca5a5" : "#b91c1c", fontSize: "13px", lineHeight: "1.5" }}>
              Han pasado <strong>{Math.floor(diasCerrado)} días</strong> desde que este ticket fue cerrado.
              El plazo máximo es de <strong>{DIAS_LIMITE} días</strong>.
              Por favor, <strong>crea un nuevo ticket</strong> para continuar el seguimiento.
            </p>
          </div>
        ) : (
          <>
            <label style={{
              display: "block", fontSize: "13px", fontWeight: "600",
              color: isDark ? "#94a3b8" : "#374151", marginBottom: "8px"
            }}>
              Motivo de la reapertura <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Describe por qué necesitas reabrir este ticket..."
              autoFocus
              style={{
                width: "100%", minHeight: "110px",
                padding: "10px 12px", borderRadius: "6px",
                border: `1px solid ${isDark ? "#475569" : "#d1d5db"}`,
                backgroundColor: isDark ? "#0f172a" : "#f9fafb",
                color: isDark ? "#e2e8f0" : "#1e293b",
                fontSize: "13px", resize: "vertical",
                boxSizing: "border-box", lineHeight: "1.5",
                outline: "none"
              }}
            />
            {error && (
              <p style={{ color: "#ef4444", fontSize: "12px", margin: "6px 0 0 0" }}>
                {error}
              </p>
            )}
            <p style={{ fontSize: "11px", color: isDark ? "#64748b" : "#9ca3af", margin: "6px 0 0 0" }}>
              Este comentario quedará registrado en el historial del ticket.
            </p>
          </>
        )}

        {/* Acciones */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "22px" }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 20px",
              backgroundColor: isDark ? "#334155" : "#e5e7eb",
              color: isDark ? "#f1f5f9" : "#374151",
              border: "none", borderRadius: "6px",
              cursor: "pointer", fontSize: "14px", fontWeight: "500"
            }}
          >
            Cancelar
          </button>

          {!plazoVencido && (
            <button
              onClick={handleConfirm}
              disabled={loading || !motivo.trim()}
              style={{
                padding: "9px 20px",
                backgroundColor: loading || !motivo.trim() ? (isDark ? "#475569" : "#94a3b8") : "#6366f1",
                color: "white", border: "none", borderRadius: "6px",
                cursor: loading || !motivo.trim() ? "not-allowed" : "pointer",
                fontSize: "14px", fontWeight: "bold"
              }}
            >
              {loading ? "Reabriendo..." : "Confirmar Reapertura"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
