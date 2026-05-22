import { apiGet, apiPost, tokenStore } from '@/lib/api';
import { AuthResponse, User } from '@/types';

export const authService = {
  register: (payload: {
    email: string;
    password: string;
    full_name: string;
    role: string;
  }) => apiPost<AuthResponse>('/auth/register', payload),

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await apiPost<AuthResponse>('/auth/login', { email, password });
    tokenStore.setTokens(res.access_token, res.refresh_token, res.user.role);
    return res;
  },

  logout: async () => {
    try { await apiPost('/auth/logout'); } catch {}
    tokenStore.clear();
  },

  me: () => apiGet<{ user_id: string; email: string; role: string }>('/auth/me'),

  forgotPassword: (email: string) =>
    apiPost('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    apiPost('/auth/reset-password', { token, password }),

  changePassword: (current_password: string, new_password: string) =>
    apiPost('/auth/change-password', { current_password, new_password }),

  isAuthenticated: () => !!tokenStore.getAccess(),
  getRole: () => tokenStore.getRole(),
};
