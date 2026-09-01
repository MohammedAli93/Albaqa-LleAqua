export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
/** Big-screen (host) app URL — when set, the phone can launch a configured game there. */
export const SCREEN_URL = import.meta.env.VITE_SCREEN_URL ?? '';

/**
 * How long any API call may hang before we give up on it. A request that never
 * settles used to leave the screen spinning forever — the login button stuck on
 * «…», the category picker stuck on «لحظة…» (client 2026-08-30). Callers get a
 * TIMEOUT they can show a retry for instead.
 */
export const API_TIMEOUT_MS = 15_000;

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: init?.signal ?? ctrl.signal,
      // Never read an API response out of the HTTP cache. The profile GET is the
      // one that bit us: after a game the balance and the win record had already
      // changed on the server, and the phone kept re-serving the cached body until
      // the player force-reloaded (client 2026-09-01).
      cache: init?.cache ?? 'no-store',
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (e) {
    throw new Error((e as Error)?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }
  const json = await res.json().catch(() => null);
  if (!json?.ok) throw new Error(json?.error?.code ?? 'REQUEST_FAILED');
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
