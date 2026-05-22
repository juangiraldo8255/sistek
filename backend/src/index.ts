// Punto de entrada del backend

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import pool from './config/database'; // Importar conexión a DB
import userRoutes from './routes/userRoutes';
import ticketRoutes from './routes/ticketRoutes';
import notificationRoutes from './routes/notificationRoutes';
import reportRoutes from './routes/reportRoutes';
import attachmentRoutes from './routes/attachmentRoutes';
import { createNotificationsTable } from './services/notificationService';
import { migratePrioritiesToNewValues, createTicketHistoriaTable } from './services/ticketService';
import { createCommentsTable } from './services/commentService';
import { createAttachmentsTable } from './services/attachmentService';
import { createRatingsTable } from './services/ratingService';
import { createPasswordResetTable } from './services/passwordResetService';

// Cargar variables de entorno
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Middlewares
app.use(express.json()); // Para parsear JSON
app.use(cors()); // Habilitar CORS

// Servir archivos adjuntos públicamente desde /uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Ticket System Backend');
});

// Ruta de prueba para DB
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'DB connected', time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Rutas de la API
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/attachments', attachmentRoutes);

createNotificationsTable()
  .then(() => console.log('✅ Tabla notifications lista'))
  .catch((err) => console.error('❌ Error creando tabla notifications:', err));

createTicketHistoriaTable()
  .then(() => console.log('✅ Tabla ticket_historia lista'))
  .catch((err) => console.error('❌ Error creando tabla ticket_historia:', err));

migratePrioritiesToNewValues()
  .then(() => console.log('✅ Prioridades migradas a Alta/Media/Baja'))
  .catch((err) => console.error('❌ Error migrando prioridades:', err));

createCommentsTable()
  .then(() => console.log('✅ Tabla comments lista'))
  .catch((err) => console.error('❌ Error creando tabla comments:', err));

createAttachmentsTable()
  .then(() => console.log('✅ Tabla attachments lista'))
  .catch((err) => console.error('❌ Error creando tabla attachments:', err));

createRatingsTable()
  .then(() => console.log('✅ Tabla ticket_ratings lista'))
  .catch((err) => console.error('❌ Error creando tabla ticket_ratings:', err));

createPasswordResetTable()
  .then(() => console.log('✅ Tabla password_reset_tokens lista'))
  .catch((err) => console.error('❌ Error creando tabla password_reset_tokens:', err));

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? 'Configurado' : 'No configurado (usando default)'}`);
});
