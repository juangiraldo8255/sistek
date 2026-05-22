import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import "../styles.css";

type PageState = "idle" | "loading" | "sent";

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pageState, setPageState] = useState<PageState>("idle");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("El correo electrónico es obligatorio");
      return;
    }

    setPageState("loading");
    setError("");

    try {
      await authService.forgotPassword(email.trim());
      setPageState("sent");
    } catch (err: any) {
      setError(err.message || "Error al procesar la solicitud");
      setPageState("idle");
    }
  };

  return (
    <div className="auth-container">

      {/* PANEL IZQUIERDO */}
      <div className="left-panel">
        <h1>Sistek</h1>
        <p>Recupera el acceso a tu cuenta</p>
      </div>

      {/* PANEL DERECHO */}
      <div className="right-panel">
        <div className="form-box">

          {pageState === "sent" ? (
            /* ── Estado: correo enviado ── */
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                backgroundColor: "#dcfce7", display: "flex",
                alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px auto", fontSize: "28px"
              }}>
                ✉️
              </div>
              <h2 style={{ marginBottom: "12px" }}>Revisa tu correo</h2>
              <p style={{ color: "#475569", fontSize: "14px", lineHeight: "1.6", marginBottom: "20px" }}>
                Si el correo <strong>{email}</strong> está registrado, recibirás
                un enlace de recuperación en los próximos minutos.
              </p>
              <p style={{
                backgroundColor: "#f1f5f9", padding: "10px 14px",
                borderRadius: "6px", fontSize: "13px", color: "#64748b",
                marginBottom: "24px"
              }}>
                El enlace expirará en <strong>30 minutos</strong>.
              </p>
              <button
                onClick={() => navigate("/")}
                style={{ backgroundColor: "#2563eb" }}
              >
                Volver al inicio de sesión
              </button>
              <p className="link" style={{ marginTop: "14px" }}>
                <span
                  onClick={() => { setPageState("idle"); setEmail(""); }}
                  style={{ color: "#2563eb", cursor: "pointer" }}
                >
                  Usar otro correo
                </span>
              </p>
            </div>
          ) : (
            /* ── Estado: formulario ── */
            <>
              <h2>¿Olvidaste tu contraseña?</h2>
              <p style={{ color: "#475569", fontSize: "14px", marginBottom: "6px", marginTop: "0" }}>
                Ingresa tu correo y te enviaremos un enlace para restablecerla.
              </p>

              {error && (
                <p style={{
                  color: "#ef4444", backgroundColor: "#fef2f2",
                  padding: "8px 12px", borderRadius: "4px",
                  fontSize: "13px", margin: "10px 0 0 0"
                }}>
                  {error}
                </p>
              )}

              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                disabled={pageState === "loading"}
                autoFocus
              />

              <button
                onClick={handleSubmit}
                disabled={pageState === "loading"}
                style={{ backgroundColor: "#2563eb" }}
              >
                {pageState === "loading" ? "Enviando..." : "Enviar enlace de recuperación"}
              </button>

              <p className="link" style={{ marginTop: "14px" }}>
                <span
                  onClick={() => navigate("/")}
                  style={{ color: "#2563eb", cursor: "pointer" }}
                >
                  ← Volver al inicio de sesión
                </span>
              </p>
            </>
          )}

        </div>
      </div>

    </div>
  );
}

export default ForgotPassword;
