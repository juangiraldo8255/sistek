import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Crear carpeta si no existe al iniciar
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (ALLOWED_MIMES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato no permitido. Solo se aceptan JPG, PNG, PDF y DOCX.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

export { UPLOAD_DIR };
