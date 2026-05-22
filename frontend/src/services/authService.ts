const API_URL = 'http://localhost:4000/api';

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
}

let tokenRefreshInterval: NodeJS.Timeout | null = null;

export const authService = {
  // Decodificar JWT para obtener el tiempo de expiración
  private_getTokenExpiration(token: string): number {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000; // Convertir a millisegundos
    } catch (e) {
      return 0;
    }
  },

  // Renovar token antes de que expire
  async setupTokenRefresh(): Promise<void> {
    const token = this.getToken();
    if (!token) return;

    // Limpiar intervalo anterior si existe
    if (tokenRefreshInterval) {
      clearInterval(tokenRefreshInterval);
    }

    const expirationTime = this.private_getTokenExpiration(token);
    const now = Date.now();
    const timeUntilExpiry = expirationTime - now;
    
    // Renovar token 5 minutos antes de que expire (si expiry > 5 min)
    const refreshTime = Math.max(timeUntilExpiry - 5 * 60 * 1000, 60 * 1000);

    tokenRefreshInterval = setInterval(() => {
      this.refreshToken().catch(() => {
        // Si falla, logout
        this.logout();
        window.location.href = '/';
      });
    }, refreshTime);
  },

  // Renovar token
  async refreshToken(): Promise<void> {
    const token = this.getToken();
    if (!token) throw new Error('No token available');

    const response = await fetch(`${API_URL}/users/refresh-token`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      this.logout();
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    
    // Configurar nuevo intervalo de refresh
    this.setupTokenRefresh();
  },

  // Limpiar intervalo de refresh
  clearTokenRefresh(): void {
    if (tokenRefreshInterval) {
      clearInterval(tokenRefreshInterval);
      tokenRefreshInterval = null;
    }
  },
  // Registrar usuario
  async register(username: string, email: string, password: string, role: string = 'cliente'): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, role })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    
    const data: AuthResponse = await response.json();
    
    // Guardar token y usuario en localStorage
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    // Configurar refresh token
    this.setupTokenRefresh();
    
    return data;
  },

  // Login
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    
    const data: AuthResponse = await response.json();
    
    // Guardar token y usuario en localStorage
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    // Configurar refresh token
    this.setupTokenRefresh();
    
    return data;
  },

  // Logout
  logout(): void {
    this.clearTokenRefresh();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Obtener usuario autenticado
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Obtener token
  getToken(): string | null {
    return localStorage.getItem('token');
  },

  // Verificar si está autenticado
  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  },

  // Obtener token para headers
  getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  },

  // Obtener perfil del usuario
  async getProfile(): Promise<User> {
    const response = await fetch(`${API_URL}/users/profile`, {
      headers: this.getAuthHeaders()
    });
    
    if (!response.ok) throw new Error('Error fetching profile');
    return response.json();
  },

  // Obtener todos los usuarios (solo admin)
  async getUsers(): Promise<User[]> {
    const response = await fetch(`${API_URL}/users`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error fetching users');
    return response.json();
  },

  // Obtener usuario por ID
  async getUser(id: number): Promise<User> {
    const response = await fetch(`${API_URL}/users/${id}`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error('User not found');
    return response.json();
  },

  // Obtener lista de agentes
  async getAgents(): Promise<User[]> {
    const response = await fetch(`${API_URL}/users/agents/list`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Error fetching agents');
    return response.json();
  },

  // Solicitar recuperación de contraseña
  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await fetch(`${API_URL}/users/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    return response.json();
  },

  // Verificar si un token de recuperación es válido (sin consumirlo)
  async verifyResetToken(token: string): Promise<{ valid: boolean; reason?: string }> {
    const response = await fetch(
      `${API_URL}/users/verify-reset-token?token=${encodeURIComponent(token)}`
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { valid: false, reason: data.reason ?? 'invalid' };
    }
    return response.json();
  },

  // Restablecer contraseña con token válido
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const response = await fetch(`${API_URL}/users/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    return response.json();
  },
};
