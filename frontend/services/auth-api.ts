import api, { setAccessToken, clearAccessToken } from './api';
import { LoginRequest, RegisterRequest, AuthResponse, User } from '@/types/auth';

export const authApi = {
  async register(tenantId: string, data: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>(`/auth/tenants/${tenantId}/register`, data);
    setAccessToken(response.data.accessToken);
    return response.data;
  },

  async login(tenantId: string, data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>(`/auth/tenants/${tenantId}/login`, data);
    setAccessToken(response.data.accessToken);
    return response.data;
  },

  async signup(data: {
    businessName: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/signup', data);
    setAccessToken(response.data.accessToken);
    return response.data;
  },

  async globalLogin(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', data);
    setAccessToken(response.data.accessToken);
    return response.data;
  },

  // Cookie is sent automatically by the browser — no body needed
  async refresh(): Promise<{ accessToken: string }> {
    const response = await api.post<{ accessToken: string }>('/auth/refresh');
    setAccessToken(response.data.accessToken);
    return response.data;
  },

  // Cookie is sent automatically — backend clears it via Set-Cookie
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      clearAccessToken();
    }
  },

  async me(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },
};
