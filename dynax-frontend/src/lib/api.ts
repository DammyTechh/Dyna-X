import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import { APIResponse, PaginatedResponse } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

// ─── Token Management ─────────────────────────────────────────────────────────

const TOKEN_KEY = 'dynax_access_token';
const REFRESH_KEY = 'dynax_refresh_token';
const ROLE_KEY = 'dynax_role';
const USER_ID_KEY = 'dynax_user_id';

// Cookie lifetime, matched to the refresh-token horizon
// (backend JWT_REFRESH_EXPIRY_HOURS=168). The cookie is a session marker for
// the middleware, not a copy of the access token's lifetime: it keeps people
// past the route guard for 7 days while AuthInitializer renews the access
// token in the background.
const DEFAULT_TOKEN_MAX_AGE = 604800;

// Share auth cookies across *.dynax.app subdomains (www ↔ scanner) in production.
function cookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.location.hostname.endsWith('dynax.app') ? '.dynax.app' : undefined;
}

export const tokenStore = {
  getAccess: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY) || Cookies.get(TOKEN_KEY) || null;
  },
  getRefresh: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_KEY) || null;
  },
  setTokens: (access: string, refresh: string, role: string, expiresIn?: number) => {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(ROLE_KEY, role);
    // Mirror the token + role into cookies so the server-side middleware can
    // read them. SameSite=Lax (not Strict) is what makes this survive a PWA
    // launch: a home-screen launch is a top-level navigation with no same-site
    // context, so Strict cookies are withheld and middleware sees no session.
    const domain = cookieDomain();
    // Never shorter than the refresh horizon — a cookie that expired with the
    // access token would bounce a still-refreshable session at the middleware.
    const maxAge = Math.max(expiresIn && expiresIn > 0 ? expiresIn : 0, DEFAULT_TOKEN_MAX_AGE);
    const opts = {
      path: '/',
      expires: new Date(Date.now() + maxAge * 1000),
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      domain,
    };
    Cookies.set(TOKEN_KEY, access, opts);
    Cookies.set(ROLE_KEY, role, opts);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(USER_ID_KEY);
    // Removal must repeat the attributes the cookie was written with, so clear
    // both the host-only and the shared *.dynax.app variants.
    const domain = cookieDomain();
    Cookies.remove(TOKEN_KEY, { path: '/' });
    Cookies.remove(ROLE_KEY, { path: '/' });
    Cookies.remove(TOKEN_KEY, { path: '/', domain });
    Cookies.remove(ROLE_KEY, { path: '/', domain });
  },
  getRole: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ROLE_KEY) || Cookies.get(ROLE_KEY) || null;
  },
  getUserId: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(USER_ID_KEY) || null;
  },
  setUserId: (id: string) => {
    if (typeof window === 'undefined' || !id) return;
    localStorage.setItem(USER_ID_KEY, id);
  },
};

// ─── Session bootstrap ────────────────────────────────────────────────────────
// A PWA is usually reopened long after it was last used, so the access token is
// often already expired at launch. Refreshing up front (rather than waiting for
// the first 401) is what keeps people signed in without a login-screen flash.

// Treat a token as expired slightly early so it can't lapse mid-flight.
const CLOCK_SKEW_SECONDS = 30;

export function isTokenExpired(token: string | null, skew = CLOCK_SKEW_SECONDS): boolean {
  if (!token) return true;
  try {
    const { exp } = jwtDecode<{ exp?: number }>(token);
    if (!exp) return false; // no exp claim — let the server be the judge
    return exp * 1000 <= Date.now() + skew * 1000;
  } catch {
    return true; // unparseable — force a refresh attempt
  }
}

// One in-flight refresh at a time; concurrent callers share the same promise.
let refreshPromise: Promise<string | null> | null = null;

export function refreshSession(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken || refreshToken === 'undefined') return Promise.resolve(null);

  refreshPromise = (async () => {
    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
      const newAccess = data.data?.access_token;
      if (!newAccess) return null;
      const role = tokenStore.getRole() || 'patient';
      // Some refresh responses omit refresh_token — keep the existing one
      // rather than persisting undefined, which would end the session.
      // Passing expires_in re-stamps the cookies with the new token's lifetime.
      tokenStore.setTokens(
        newAccess,
        data.data?.refresh_token || refreshToken,
        role,
        data.data?.expires_in
      );
      return newAccess as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Restores the session on app launch. Returns true when a usable access token
 * is in place afterwards.
 *
 * Deliberately does not redirect: this runs from the root layout, which also
 * wraps public marketing pages. Route protection stays with the middleware and
 * the individual route guards.
 */
export async function ensureFreshSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const access = tokenStore.getAccess();
  if (access && !isTokenExpired(access)) return true;

  if (!tokenStore.getRefresh()) {
    if (access) tokenStore.clear(); // expired access with no way to renew
    return false;
  }

  if (await refreshSession()) return true;

  tokenStore.clear();
  return false;
}

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

// Response interceptor — auto-refresh on 401.
// Shares refreshSession() with the launch bootstrap, so concurrent 401s and a
// startup refresh all await a single request instead of racing each other.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      const newToken = await refreshSession();
      if (newToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return api(original);
      }

      tokenStore.clear();
      window.location.href = '/auth/login';
      return Promise.reject(error);
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
