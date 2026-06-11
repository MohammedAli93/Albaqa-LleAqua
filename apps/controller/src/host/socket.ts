/** Typed Socket.IO client for the Main Screen (/screen namespace). */
import { io, type Socket } from 'socket.io-client';
import { ClientEvent, ServerEvent } from '@tahaddi/shared';
import { API_URL } from './lib/config.js';
import { syncClock } from '../lib/clock.js';
import { useStore } from './store.js';

let socket: Socket | null = null;

const ALL_SERVER_EVENTS = Object.values(ServerEvent);

export function connectHost(hostToken: string, roomCode: string): Socket {
  socket = io(`${API_URL}/screen`, {
    transports: ['websocket'],
    auth: { hostToken, roomCode },
  });

  const { setConn, applyServerEvent } = useStore.getState();

  socket.on('connect', () => {
    setConn('connected');
    // Match the players' clock to the server so the host screen and the phones
    // count down off the same true time and reveal the question together.
    syncClock(socket!);
  });
  socket.io.on('reconnect_attempt', () => setConn('reconnecting'));
  socket.on('disconnect', () => setConn('reconnecting'));

  for (const ev of ALL_SERVER_EVENTS) {
    socket.on(ev, (payload: unknown) => applyServerEvent(ev, payload));
  }
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
