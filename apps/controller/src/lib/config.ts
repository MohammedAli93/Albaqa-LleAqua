export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.code ?? 'REQUEST_FAILED');
  return json.data as T;
}

// ── Session persistence (survives refresh / lock screen) ─────────────────────
export interface Session {
  roomCode: string;
  participantId: string;
  sessionToken: string;
  nickname: string;
  avatarId: string;
}

const KEY = (code: string) => `tahaddi.session.${code.toUpperCase()}`;

export function saveSession(s: Session): void {
  localStorage.setItem(KEY(s.roomCode), JSON.stringify(s));
}
export function loadSession(code: string): Session | null {
  const raw = localStorage.getItem(KEY(code));
  return raw ? (JSON.parse(raw) as Session) : null;
}
export function clearSession(code: string): void {
  localStorage.removeItem(KEY(code));
}
