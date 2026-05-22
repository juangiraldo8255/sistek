import crypto from 'crypto';
import pool from '../config/database';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

const TOKEN_EXPIRY_MINUTES = 30;

export const createPasswordResetTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
};

// SHA-256 es apropiado para tokens de alta entropía (256 bits aleatorios),
// a diferencia de contraseñas, donde se requiere bcrypt por su bajo entropía.
const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export const createResetToken = async (userId: number): Promise<string> => {
  // Invalidar tokens anteriores no usados del mismo usuario
  await pool.query(
    'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE',
    [userId]
  );

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  return rawToken;
};

export type TokenValidationResult =
  | { valid: true; record: any }
  | { valid: false; reason: 'invalid' | 'expired' | 'used' };

export const validateResetToken = async (rawToken: string): Promise<TokenValidationResult> => {
  if (!rawToken || rawToken.length !== 64) {
    return { valid: false, reason: 'invalid' };
  }

  const tokenHash = hashToken(rawToken);
  const result = await pool.query(
    `SELECT prt.*, u.email
     FROM password_reset_tokens prt
     JOIN users u ON prt.user_id = u.id
     WHERE prt.token_hash = $1`,
    [tokenHash]
  );

  const record = result.rows[0];
  if (!record) return { valid: false, reason: 'invalid' };
  if (record.used) return { valid: false, reason: 'used' };
  if (new Date(record.expires_at) < new Date()) return { valid: false, reason: 'expired' };

  return { valid: true, record };
};

export const consumeResetToken = async (rawToken: string, newPassword: string): Promise<void> => {
  const validation = await validateResetToken(rawToken);
  if (!validation.valid) {
    const messages: Record<string, string> = {
      expired: 'El enlace de recuperación ha expirado. Solicita uno nuevo.',
      used: 'Este enlace ya fue utilizado. Solicita uno nuevo.',
      invalid: 'El enlace no es válido.',
    };
    throw new Error(messages[validation.reason] ?? 'Enlace inválido');
  }

  const { record } = validation;
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, record.user_id]);
    await client.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [record.id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const sendResetEmail = async (toEmail: string, rawToken: string): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Sistek" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Recuperación de contraseña — Sistek',
    html: `
      <div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:8px;">
        <div style="background:#2563eb;padding:20px 28px;border-radius:6px 6px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">Sistek</h1>
          <p style="color:#bfdbfe;margin:4px 0 0 0;font-size:13px;">Sistema de Tickets</p>
        </div>
        <div style="background:white;padding:28px;border-radius:0 0 6px 6px;border:1px solid #e2e8f0;border-top:none;">
          <h2 style="color:#1e293b;margin:0 0 16px 0;">Recuperación de contraseña</h2>
          <p style="color:#475569;line-height:1.6;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Sistek</strong>.
          </p>
          <p style="color:#475569;line-height:1.6;">
            Haz clic en el botón para crear una nueva contraseña:
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${resetLink}"
               style="background:#2563eb;color:white;padding:13px 28px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;display:inline-block;">
              Restablecer contraseña
            </a>
          </div>
          <p style="color:#64748b;font-size:13px;background:#f1f5f9;padding:10px 14px;border-radius:4px;">
            ⏰ Este enlace expirará en <strong>${TOKEN_EXPIRY_MINUTES} minutos</strong>.
          </p>
          <p style="color:#94a3b8;font-size:12px;margin-top:20px;">
            Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña no se modificará.
          </p>
          <p style="color:#94a3b8;font-size:11px;margin-top:12px;word-break:break-all;">
            Si el botón no funciona, copia este enlace en tu navegador:<br>${resetLink}
          </p>
        </div>
      </div>
    `,
  });
};
