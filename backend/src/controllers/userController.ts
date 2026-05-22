import { Request, Response } from 'express';
import * as userService from '../services/userService';
import * as passwordResetService from '../services/passwordResetService';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const GENERIC_RESET_MESSAGE =
  'Si el correo está registrado, recibirás un enlace de recuperación en los próximos minutos.';

// Registrar usuario (HU-1)
export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Usuario, email y password son requeridos' });
    }

    const existingUser = await userService.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    const newUser = await userService.createUser(username, email, password, role || 'cliente');

    const token = userService.generateToken(newUser.id, newUser.username, newUser.role);

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: newUser,
      token
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al registrar usuario: ' + error.message });
  }
};

// Login (HU-1)
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password son requeridos' });
    }

    const user = await userService.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const isPasswordValid = await userService.validatePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = userService.generateToken(user.id, user.username, user.role);

    res.json({
      message: 'Login exitoso',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error en el login: ' + error.message });
  }
};

// Obtener todos los usuarios (solo admin)
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener usuarios: ' + error.message });
  }
};

// Obtener usuario por ID
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(parseInt(id));
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener usuario: ' + error.message });
  }
};

// Obtener perfil del usuario autenticado
export const getProfile = async (req: Request, res: Response) => {
  try {
    const user = await userService.getUserById(req.userId!);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener perfil: ' + error.message });
  }
};

// Refresh token
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Generar nuevo token
    const newToken = userService.generateToken(user.userId, user.username, user.role);

    res.json({
      message: 'Token renovado',
      token: newToken
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al renovar token: ' + error.message });
  }
};

// Obtener agentes (HU-5)
export const getAgents = async (req: Request, res: Response) => {
  try {
    const agents = await userService.getAgents();
    res.json(agents);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener agentes: ' + error.message });
  }
};

// Solicitar recuperación de contraseña — respuesta genérica para evitar enumeración de correos
export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'El correo electrónico es requerido' });
  }

  try {
    const user = await userService.getUserByEmail(email.trim().toLowerCase());
    if (user) {
      const rawToken = await passwordResetService.createResetToken(user.id);
      await passwordResetService.sendResetEmail(user.email, rawToken);
    }
    // Siempre devolver el mismo mensaje, exista o no el correo
    res.json({ message: GENERIC_RESET_MESSAGE });
  } catch (error: any) {
    console.error('Error en forgotPassword:', error.message);
    // Seguir devolviendo el mismo mensaje para no exponer si el correo existe
    res.json({ message: GENERIC_RESET_MESSAGE });
  }
};

// Verificar token sin consumirlo (para el frontend al cargar la página)
export const verifyResetToken = async (req: Request, res: Response) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ valid: false, reason: 'invalid' });
  }

  try {
    const result = await passwordResetService.validateResetToken(token);
    if (result.valid) {
      res.json({ valid: true });
    } else {
      res.status(400).json({ valid: false, reason: result.reason });
    }
  } catch (error: any) {
    res.status(500).json({ valid: false, reason: 'invalid' });
  }
};

// Restablecer contraseña con token válido
export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token y nueva contraseña son requeridos' });
  }

  if (!PASSWORD_REGEX.test(newPassword)) {
    return res.status(400).json({
      error: 'La contraseña debe tener al menos 8 caracteres, una letra mayúscula, una minúscula y un número',
    });
  }

  try {
    const validation = await passwordResetService.validateResetToken(token);
    if (!validation.valid) {
      const messages: Record<string, string> = {
        expired: 'El enlace de recuperación ha expirado. Solicita uno nuevo.',
        used: 'Este enlace ya fue utilizado. Solicita uno nuevo.',
        invalid: 'El enlace no es válido o ya expiró.',
      };
      return res.status(400).json({
        error: messages[validation.reason] ?? 'Enlace inválido',
        reason: validation.reason,
      });
    }

    await passwordResetService.consumeResetToken(token, newPassword);
    res.json({ message: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
