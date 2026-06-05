/** Typed Socket.IO client for the Mobile Controller (/play namespace). */
import { io, type Socket } from 'socket.io-client';
import {
  ClientEvent,
  ServerEvent,
  type PlayerJoinAck,
  type PlayerAnswerAck,
} from '@tahaddi/shared';
import { API_URL, saveSession, type Session } from './lib/config.js';
import { useStore } from './store.js';

let socket: Socket | null = null;

const ALL_SERVER_EVENTS = Object.values(ServerEvent);

export function connect(roomCode: string, sessionToken?: string): Socket {
  if (socket) socket.disconnect();
  socket = io(`${API_URL}/play`, {
    transports: ['websocket'],
    auth: { roomCode, sessionToken },
  });

  const { set, applyServerEvent } = useStore.getState();
  socket.on('connect', () => set({ conn: 'connected' }));
  socket.io.on('reconnect_attempt', () => set({ conn: 'reconnecting' }));
  socket.on('disconnect', () => set({ conn: 'reconnecting' }));
  socket.on('connect_error', (err) => set({ conn: 'error', errorCode: (err as Error & { data?: { code?: string } }).data?.code ?? 'CONNECT_ERROR' }));

  for (const ev of ALL_SERVER_EVENTS) {
    socket.on(ev, (payload: unknown) => applyServerEvent(ev, payload));
  }
  return socket;
}

export function joinGame(nickname: string, avatarId: string): Promise<PlayerJoinAck> {
  return new Promise((resolve, reject) => {
    socket?.emit(
      ClientEvent.PLAYER_JOIN,
      { nickname, avatarId },
      (res: { ok: boolean; data?: PlayerJoinAck; error?: { code: string } }) => {
        if (res?.ok && res.data) {
          const st = useStore.getState();
          const session: Session = {
            roomCode: st.roomCode,
            participantId: res.data.participantId,
            sessionToken: res.data.sessionToken,
            nickname,
            avatarId,
          };
          saveSession(session);
          useStore.getState().set({ participantId: res.data.participantId, nickname, avatarId, phase: 'lobby' });
          resolve(res.data);
        } else {
          reject(new Error(res?.error?.code ?? 'JOIN_FAILED'));
        }
      },
    );
  });
}

export function submitAnswer(roundId: string, optionId: string): Promise<PlayerAnswerAck> {
  // Optimistic lock — UI updates instantly; ack reconciles.
  useStore.getState().set({ selectedOptionId: optionId, hasAnswered: true, phase: 'locked' });
  return new Promise((resolve, reject) => {
    socket?.emit(
      ClientEvent.PLAYER_ANSWER,
      { roundId, optionId, clientTs: Date.now() },
      (res: { ok: boolean; data?: PlayerAnswerAck; error?: { code: string } }) => {
        if (res?.ok && res.data) resolve(res.data);
        else {
          // Roll back optimistic lock if rejected (e.g. window closed).
          useStore.getState().set({ selectedOptionId: null, hasAnswered: false });
          reject(new Error(res?.error?.code ?? 'ANSWER_FAILED'));
        }
      },
    );
  });
}

/** TEAMS lobby: claim a seat on a specific team. */
export function pickTeam(teamId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket?.emit(
      ClientEvent.PLAYER_PICK_TEAM,
      { teamId },
      (res: { ok: boolean; error?: { code: string } }) => {
        if (res?.ok) resolve();
        else reject(new Error(res?.error?.code ?? 'PICK_TEAM_FAILED'));
      },
    );
  });
}

export function getSocket(): Socket | null {
  return socket;
}

// ─────────────────────────────── Seen-Jeem intents ──────────────────────────

function emitSj(event: string, payload: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    socket?.emit(event, payload, (res: { ok: boolean; error?: { code: string } }) => {
      if (res?.ok) resolve();
      else reject(new Error(res?.error?.code ?? 'FAILED'));
    });
  });
}

export const sjActions = {
  draftPick: (categoryId: string) => emitSj(ClientEvent.SJ_DRAFT_PICK, { categoryId }),
  cellSelect: (cellId: string) => emitSj(ClientEvent.SJ_CELL_SELECT, { cellId }),
  lifeline: (lifeline: string) => emitSj(ClientEvent.SJ_LIFELINE_USE, { lifeline }),
  answer: (cellId: string, optionId: string) =>
    emitSj(ClientEvent.SJ_TEAM_ANSWER, { cellId, optionId }),
};
