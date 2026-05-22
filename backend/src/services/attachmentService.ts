import pool from '../config/database';

export const createAttachmentsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attachments (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id  INTEGER NOT NULL REFERENCES users(id)   ON DELETE RESTRICT,
      filename      VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type     VARCHAR(100) NOT NULL,
      size          INTEGER NOT NULL,
      created_at    TIMESTAMP DEFAULT NOW()
    )
  `);
};

export const createAttachment = async (
  ticketId: number,
  userId: number,
  filename: string,
  originalName: string,
  mimeType: string,
  size: number
) => {
  const result = await pool.query(
    `INSERT INTO attachments (ticket_id, user_id, filename, original_name, mime_type, size)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [ticketId, userId, filename, originalName, mimeType, size]
  );
  return result.rows[0];
};

export const getAttachmentsByTicket = async (ticketId: number) => {
  const result = await pool.query(
    `SELECT a.*, u.username AS uploader
     FROM attachments a
     JOIN users u ON a.user_id = u.id
     WHERE a.ticket_id = $1
     ORDER BY a.created_at ASC`,
    [ticketId]
  );
  return result.rows;
};

export const getAttachmentById = async (id: number) => {
  const result = await pool.query(
    `SELECT a.*, u.username AS uploader
     FROM attachments a
     JOIN users u ON a.user_id = u.id
     WHERE a.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
};

export const deleteAttachmentRecord = async (id: number) => {
  const result = await pool.query(
    'DELETE FROM attachments WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0] ?? null;
};
