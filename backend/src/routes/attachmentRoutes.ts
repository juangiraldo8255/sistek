import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as attachmentController from '../controllers/attachmentController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { upload } from '../middleware/upload';

const router = Router();
router.use(authMiddleware);

// Wrapper que convierte errores de Multer en respuestas JSON
const multerUpload = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'El archivo supera el límite de 10 MB.' });
      }
      return res.status(400).json({ error: `Error de carga: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// Subir adjunto a un ticket
router.post('/ticket/:ticketId', multerUpload, attachmentController.uploadAttachment);

// Listar adjuntos de un ticket
router.get('/ticket/:ticketId', attachmentController.getAttachments);

// Servir/previsualizar archivo
router.get('/:id/file', attachmentController.serveFile);

// Eliminar adjunto
router.delete('/:id', attachmentController.deleteAttachment);

export default router;
