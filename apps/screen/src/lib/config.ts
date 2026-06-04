/** Runtime config from Vite env (with sensible local defaults). */
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
export const CONTROLLER_URL = import.meta.env.VITE_CONTROLLER_URL ?? 'http://localhost:5174';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message ?? 'Request failed');
  return json.data as T;
}
