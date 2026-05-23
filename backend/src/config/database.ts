import { Pool } from 'pg';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL no está configurada. Por favor, revisa tu archivo .env');
}

const isRemoteDb = process.env.DATABASE_URL?.includes('railway') ||
  process.env.DATABASE_URL?.includes('rlwy.net') ||
  process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Error no controlado en el pool:', err);
});

export default pool;
