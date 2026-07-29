import * as SecureStore from 'expo-secure-store';

// Points at the single DynaX backend. Override per build with EXPO_PUBLIC_API_URL.
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || 'https://dynax.app/api/v1';

const TOKEN_KEY = 'dynax_access_token';

export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (t: string) => SecureStore.setItemAsync(TOKEN_KEY, t),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

type Envelope<T> = { success?: boolean; message?: string; data?: T; error?: { message?: string } };

async function authHeader(): Promise<Record<string, string>> {
  const token = await tokenStore.get();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function unwrap<T>(res: Response): Promise<T> {
  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    /* non-JSON */
  }
  if (!res.ok || (body && body.success === false)) {
    throw new Error(body?.error?.message || body?.message || `Request failed (${res.status})`);
  }
  return (body?.data ?? (body as unknown as T)) as T;
}

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, { headers: { ...(await authHeader()) } });
    return unwrap<T>(res);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return unwrap<T>(res);
  },

  // Upload a captured video as the raw request body (matches PUT /scans/:id/input).
  async putVideo<T>(path: string, fileUri: string, mimeType: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType, ...(await authHeader()) },
      // React Native fetch streams a file URI when given as the body.
      body: { uri: fileUri } as unknown as BodyInit,
    });
    return unwrap<T>(res);
  },

  // Authenticated blob URL for a stored asset (used to download/share the model).
  assetDownloadUrl: (assetId: string) => `${API_BASE}/scanner/assets/${assetId}/download`,
  authHeader,
};
