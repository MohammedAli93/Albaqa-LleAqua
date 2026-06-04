/** Fetch wrapper: attaches the access token, transparently refreshes once on 401. */
import { useAuth } from '../store/auth.js';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function refresh(): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include' });
  if (!res.ok) return false;
  const json = await res.json();
  if (!json.ok) return false;
  // We don't get the user here; keep existing user, swap token.
  const user = useAuth.getState().user;
  if (user) useAuth.getState().setAuth(json.data.accessToken, user);
  return json.ok;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = useAuth.getState().accessToken;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 && retry) {
    if (await refresh()) return apiFetch<T>(path, init, false);
    useAuth.getState().clear();
  }

  const json = await res.json().catch(() => ({ ok: false, error: { code: 'PARSE', message: 'Bad response' } }));
  if (!json.ok) throw new ApiError(json.error?.code ?? 'ERROR', json.error?.message ?? 'Request failed');
  return json.data as T;
}

export const get = <T>(p: string) => apiFetch<T>(p);
export const post = <T>(p: string, body?: unknown) => apiFetch<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) });
export const patch = <T>(p: string, body?: unknown) => apiFetch<T>(p, { method: 'PATCH', body: JSON.stringify(body ?? {}) });
export const put = <T>(p: string, body?: unknown) => apiFetch<T>(p, { method: 'PUT', body: JSON.stringify(body ?? {}) });
export const del = <T>(p: string) => apiFetch<T>(p, { method: 'DELETE' });
