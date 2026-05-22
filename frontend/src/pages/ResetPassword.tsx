import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "../services/authService";
import "../styles.css";

type PageState = "checking" | "valid" | "expired" | "used" | "invalid" | "success";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const requirements = [
  { label: "Al menos 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Una letra mayúscula", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Una letra minúscula", test: (p: string) => /[a-z]/.test(p) },
  { label: "Un número", test: (p: string) => /\d/.test(p) },
];

function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [pageState, setPageState] = useState<PageState>("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setPageState("invalid");
      return;
    }
    authService.verifyResetToken(token).then((result) => {
      if (result.valid) {
        setPageState("valid");
      } else {
        setPageState((result.reason as PageState) ?? "invalid");
      }
    });
  }, [token]);

  const handleSubmit = async () => {
    setError("");

    if (!newPassword || !confirmPassword) {
      setError("Completa todos los campos");
      return;
    }
    if (!PASSWORD_REGEX.test(newPassword)) {
      setError("La contraseña no cumple con los requisitos mínimos de seguridad");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setSubmitting(true);
    try {
      await authService.resetPassword(token, newPassword);
      setPageState("success");
    } catch (err: any) {
      const msg: string = err.message ?? "";
      if (msg.toLowerCase().includes("expirado")) setPageState("expired");
      else if (msg.toLowerCase().includes("utilizado")) setPageState("used");
      else setError(msg || "Error al restablecer la contraseña");
    } finally {
      setSubmitting(false);
    }
  };

  const passwordStrength = requirements.filter((r) => r.test(newPassword)).length;

  const strengthColor =
    passwordStrength <= 1 ? "#ef4444" :
    passwordStrength <= 2 ? "#f59e0b" :
    passwordStrength <= 3 ? "#3b82f6" : "#10b981";

  return (
    <div className="auth-container">

      {/* PANEL IZQUIERDO */}
      <div className="left-panel">
        <h1>Sistek</h1>
        <p>Crea una nueva contraseña segura</p>
      </div>

      {/* PANEL DERECHO */}
      <div className="right-panel">
        <div className="form-box">

          {/* ── Verificando ── */}
          {pageState === "checking" && (
            <p style={{ color: "#64748b", textAlign: "center" }}>Verificando enlace...</p>
          )}

          {/* ── Éxito ── */}
          {pageState === "success" && (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                backgroundColor: "#dcfce7", display: "flex",
                alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px auto", fontSize: "28px"
              }}>
                ✅
              </div>
              <h2 style={{ marginBottom: "12px" }}>Contraseña actualizada</h2>
              <p style={{ color: "#475569", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px" }}>
                Tu contraseña fue restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
              <button
                onClick={() => navigate("/")}
                style={{ backgroundColor: "#10b981" }}
              >
                Iniciar sesión
              </button>
            </div>
          )}

          {/* ── Enlace expirado ── */}
          {pageState === "expired" && (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                backgroundColor: "#fef3c7", display: "flex",
                alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px auto", fontSize: "28px"
              }}>
                ⏰
              </div>
              <h2 style={{ marginBottom: "12px" }}>Enlace expirado</h2>
              <p style={{ color: "#475569", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px" }}>
                Este enlace de recuperación ha expirado (validez de 30 minutos).
                Solicita uno nuevo para continuar.
              </p>
              <button
                onClick={() => navigate("/forgot-password")}
                style={{ backgroundColor: "#2563eb" }}
              >
                Solicitar nuevo enlace
              </button>
              <p className="link" style={{ marginTop: "14px" }}>
                <span onClick={() => navigate("/")} style={{ color: "#2563eb", cursor: "pointer" }}>
                  Volver al inicio de sesión
                </span>
              </p>
            </div>
          )}

          {/* ── Enlace ya usado ── */}
          {pageState === "used" && (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                backgroundColor: "#fee2e2", display: "flex",
                alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px auto", fontSize: "28px"
              }}>
                🔒
              </div>
              <h2 style={{ marginBottom: "12px" }}>Enlace ya utilizado</h2>
              <p style={{ color: "#475569", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px" }}>
                Este enlace de recuperación ya fue utilizado anteriormente.
                Si necesitas cambiar la contraseña nuevamente, solicita un nuevo enlace.
              </p>
              <button
                onClick={() => navigate("/forgot-password")}
                style={{ backgroundColor: "#2563eb" }}
              >
                Solicitar nuevo enlace
              </button>
              <p className="link" style={{ marginTop: "14px" }}>
                <span onClick={() => navigate("/")} style={{ color: "#2563eb", cursor: "pointer" }}>
                  Volver al inicio de sesión
                </span>
              </p>
            </div>
          )}

          {/* ── Enlace inválido ── */}
          {pageState === "invalid" && (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                backgroundColor: "#fee2e2", display: "flex",
                alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px auto", fontSize: "28px"
              }}>
                ❌
              </div>
              <h2 style={{ marginBottom: "12px" }}>Enlace no válido</h2>
              <p style={{ color: "#475569", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px" }}>
                El enlace de recuperación no es válido o ha expirado.
                Solicita uno nuevo para continuar.
              </p>
              <button
                onClick={() => navigate("/forgot-password")}
                style={{ backgroundColor: "#2563eb" }}
              >
                Solicitar nuevo enlace
              </button>
              <p className="link" style={{ marginTop: "14px" }}>
                <span onClick={() => navigate("/")} style={{ color: "#2563eb", cursor: "pointer" }}>
                  Volver al inicio de sesión
                </span>
              </p>
            </div>
          )}

          {/* ── Formulario de nueva contraseña ── */}
          {pageState === "valid" && (
            <>
              <h2>Nueva contraseña</h2>
              <p style={{ color: "#475569", fontSize: "14px", margin: "0 0 4px 0" }}>
                Elige una contraseña segura para tu cuenta.
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

              {/* Input contraseña con botón mostrar/ocultar */}
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nueva contraseña"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={submitting}
                  style={{ paddingRight: "44px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: "absolute", right: "10px", top: "50%",
                    transform: "translateY(-50%)", width: "auto",
                    background: "none", border: "none", color: "#64748b",
                    cursor: "pointer", padding: "4px", marginTop: "5px",
                    fontSize: "13px"
                  }}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>

              {/* Barra de fortaleza */}
              {newPassword.length > 0 && (
                <div style={{ marginTop: "8px" }}>
                  <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1, height: "4px", borderRadius: "2px",
                          backgroundColor: i <= passwordStrength ? strengthColor : "#e2e8f0",
                          transition: "background-color 0.2s"
                        }}
                      />
                    ))}
                  </div>
                  <ul style={{ margin: "0", padding: "0 0 0 16px", fontSize: "12px" }}>
                    {requirements.map((r) => (
                      <li
                        key={r.label}
                        style={{ color: r.test(newPassword) ? "#10b981" : "#94a3b8", lineHeight: "1.7" }}
                      >
                        {r.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <input
                type={showPassword ? "text" : "password"}
                placeholder="Confirmar contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                disabled={submitting}
                style={{
                  borderColor: confirmPassword.length > 0 && confirmPassword !== newPassword
                    ? "#ef4444" : undefined
                }}
              />

              {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                <p style={{ color: "#ef4444", fontSize: "12px", margin: "4px 0 0 0" }}>
                  Las contraseñas no coinciden
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || !PASSWORD_REGEX.test(newPassword) || newPassword !== confirmPassword}
                style={{
                  backgroundColor:
                    submitting || !PASSWORD_REGEX.test(newPassword) || newPassword !== confirmPassword
                      ? "#94a3b8" : "#2563eb",
                  cursor:
                    submitting || !PASSWORD_REGEX.test(newPassword) || newPassword !== confirmPassword
                      ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Actualizando..." : "Guardar nueva contraseña"}
              </button>

              <p className="link" style={{ marginTop: "14px" }}>
                <span onClick={() => navigate("/")} style={{ color: "#2563eb", cursor: "pointer" }}>
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

export default ResetPassword;
