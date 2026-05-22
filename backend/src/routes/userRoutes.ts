import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authMiddleware, adminOnly } from '../middlewares/authMiddleware';

const router = Router();

// Rutas de autenticación (sin middleware)
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/refresh-token', authMiddleware, userController.refreshToken);

// Recuperación de contraseña (sin middleware — rutas públicas)
router.post('/forgot-password', userController.forgotPassword);
router.get('/verify-reset-token', userController.verifyResetToken);
router.post('/reset-password', userController.resetPassword);

// Rutas protegidas
router.get('/profile', authMiddleware, userController.getProfile);
router.get('/', authMiddleware, adminOnly, userController.getUsers);
router.get('/:id', authMiddleware, userController.getUserById);

// Rutas de agentes (HU-5)
router.get('/agents/list', authMiddleware, adminOnly, userController.getAgents);

export default router;
