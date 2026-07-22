/** Typed Socket.IO client for the Main Screen (/screen namespace). */
import { io, type Socket } from 'socket.io-client';
import { ClientEvent, ServerEvent } from '@tahaddi/shared';
import { API_URL } from './lib/config.js';
import { useStore } from './store.js';

let socket: Socket | null = null;

const ALL_SERVER_EVENTS = Object.values(ServerEvent);

/**
 * Self-heal on resume. If the screen tab is backgrounded (or the network blips)
 * it can silently miss an event and appear "stuck". When it returns to the
 * foreground / regains network, force an immediate reconnect if the socket
 * dropped, or ask the server to re-push the authoritative snapshot if it still
 * looks connected — automating a manual page reload.
 */
let resumeHooked = false;
function hookResume(): void {
  if (resumeHooked || typeof document === 'undefined') return;
  resumeHooked = true;
  const resume = () => {
    if (document.visibilityState === 'hidden') return;
    const s = socket;
    if (!s) return;
    if (!s.connected) s.connect();
    else s.emit(ClientEvent.PLAYER_RESYNC, {});
  };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('focus', resume);
  window.addEventListener('online', resume);
}

export function connectHost(hostToken: string, roomCode: string): Socket {
  socket = io(`${API_URL}/screen`, {
    transports: ['websocket'],
    auth: { hostToken, roomCode },
  });

  const { setConn, applyServerEvent } = useStore.getState();

  socket.on('connect', () => setConn('connected'));
  socket.io.on('reconnect_attempt', () => setConn('reconnecting'));
  socket.on('disconnect', () => setConn('reconnecting'));

  for (const ev of ALL_SERVER_EVENTS) {
    socket.on(ev, (payload: unknown) => applyServerEvent(ev, payload));
  }
  hookResume();
  return socket;
}

function emit(event: string, payload: Record<string, unknown> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    socket?.emit(event, payload, (res: { ok: boolean; error?: { message: string } }) => {
      if (res?.ok) resolve();
      else reject(new Error(res?.error?.message ?? 'failed'));
    });
  });
}

export const host = {
  start: () => emit(ClientEvent.GAME_START),
  next: () => emit(ClientEvent.ROUND_NEXT),
  pause: () => emit(ClientEvent.GAME_PAUSE),
  resume: () => emit(ClientEvent.GAME_RESUME),
  end: () => emit(ClientEvent.GAME_END),
  /** Seen-Jeem: rule on a spoken answer for the open cell. */
  adjudicate: (cellId: string, correct: boolean) =>
    emit(ClientEvent.SJ_ADJUDICATE, { cellId, correct }),
};

export function disconnectHost(): void {
  socket?.disconnect();
  socket = null;
}
