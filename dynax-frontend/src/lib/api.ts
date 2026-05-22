import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import { APIResponse, PaginatedResponse } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

// ─── Token Management ─────────────────────────────────────────────────────────

const TOKEN_KEY = 'dynax_access_token';
const REFRESH_KEY = 'dynax_refresh_token';
const ROLE_KEY = 'dynax_role';

export const tokenStore = {
  getAccess: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY) || Cookies.get(TOKEN_KEY) || null;
  },
  getRefresh: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_KEY) || null;
  },
  setTokens: (access: string, refresh: string, role: string) => {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(ROLE_KEY, role);
    // also set in cookie for SSR
    Cookies.set(TOKEN_KEY, access, { expires: 1, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
    Cookies.set(ROLE_KEY, role, { expires: 7, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ROLE_KEY);
    Cookies.remove(TOKEN_KEY);
    Cookies.remove(ROLE_KEY);
  },
  getRole: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ROLE_KEY) || Cookies.get(ROLE_KEY) || null;
  },
};

// ─── Axios Instance ───────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor — attach JWT
api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto-refresh on 401
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;
      const refreshToken = tokenStore.getRefresh();

      if (!refreshToken) {
        tokenStore.clear();
        window.location.href = '/auth/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
        const newToken = data.data?.access_token;
        const role = tokenStore.getRole() || 'patient';
        tokenStore.setTokens(newToken, data.data?.refresh_token, role);
        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];
        isRefreshing = false;
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return api(original);
      } catch {
        tokenStore.clear();
        window.location.href = '/auth/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// ─── Typed helpers ────────────────────────────────────────────────────────────

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await api.get<APIResponse<T>>(url, { params });
  if (!data.success) throw new Error(data.error?.message || 'Request failed');
  return data.data as T;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.post<APIResponse<T>>(url, body);
  if (!data.success) throw new Error(data.error?.message || 'Request failed');
  return data.data as T;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.patch<APIResponse<T>>(url, body);
  if (!data.success) throw new Error(data.error?.message || 'Request failed');
  return data.data as T;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const { data } = await api.delete<APIResponse<T>>(url);
  if (!data.success) throw new Error(data.error?.message || 'Request failed');
  return data.data as T;
}

export async function apiGetPaginated<T>(url: string, params?: Record<string, unknown>): Promise<PaginatedResponse<T>> {
  const { data } = await api.get<PaginatedResponse<T>>(url, { params });
  return data;
}

export default api;
