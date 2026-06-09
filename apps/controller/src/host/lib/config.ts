/** Runtime config from Vite env (with sensible local defaults). */
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
// Merged build: the player (controller) experience IS this same app/origin, so the
// QR/join URL points back here. Falls back to an explicit env, then the dev port.
export const CONTROLLER_URL =
  import.meta.env.VITE_CONTROLLER_URL ??
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174');

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message ?? 'Request failed');
  return json.data as T;
}
