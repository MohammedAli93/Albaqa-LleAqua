/** /screen namespace — the Main Screen host. Owns control intents. */
import type { Namespace, Socket } from 'socket.io';
import {
  ClientEvent,
  ServerEvent,
  EmptySchema,
  PlayerKickSchema,
  AdjudicateSchema,
} from '@tahaddi/shared';
import { screenAuth } from '../middleware/auth.js';
import { on } from '../handlerUtil.js';
import { roomName } from '../emitter.js';
import * as engine from '../../domain/game/engine.js';
import * as sj from '../../domain/game/seenJeemEngine.js';
import { getRoom, saveRoom } from '../../domain/rooms/roomStore.js';
import type { ScreenSocketData } from '../socketContext.js';

/**
 * Host (big-screen) disconnects shouldn't pause the game instantly: the host is
 * often briefly backgrounded (e.g. switching to play on the same phone, the TV
 * dimming, a network blip). We wait out a grace period and only pause if the host
 * is still gone — and auto-resume when they come back. Module-level (per process),
 * matching the existing auto-advance timers; fine for a single server replica.
 */
const HOST_GRACE_MS = 20_000;
const hostGraceTimers = new Map<string, NodeJS.Timeout>();
const pausedByDisconnect = new Set<string>();

export function registerScreenNamespace(screenNs: Namespace): void {
  screenNs.use(screenAuth);

  screenNs.on('connection', async (socket: Socket) => {
    const ctx = socket.ctx as ScreenSocketData;
    socket.join(roomName(ctx.gameId));

    // Host (re)connected → cancel any pending disconnect-pause.
    const pending = hostGraceTimers.get(ctx.gameId);
    if (pending) {
      clearTimeout(pending);
      hostGraceTimers.delete(ctx.gameId);
    }

    // Track host socket + send full snapshot.
    const state = await getRoom(ctx.gameId);
    if (state) {
      state.hostSocketId = socket.id;
      await saveRoom(state);
      socket.emit(ServerEvent.ROOM_STATE, engine.snapshotFor(state));
    }

    // If we'd paused the game because the host dropped, resume now that they're
    // back (only auto-resume disconnect-pauses, never a deliberate host pause).
    if (pausedByDisconnect.has(ctx.gameId)) {
      pausedByDisconnect.delete(ctx.gameId);
      if (state?.status === 'PAUSED') {
        await engine.resumeGame(ctx.gameId);
      }
    }

    // Clock sync: reply with server wall-clock so the host screen can offset its
    // pre-roll/timer to true server time (keeps every device's reveal in lockstep).
    on(socket, ClientEvent.TIME_SYNC, EmptySchema, async () => ({ serverTime: Date.now() }));

    // Resync: the screen came back to the foreground / regained network. Re-push the
    // authoritative snapshot so a TV that silently missed an event self-heals without
    // a manual page reload.
    on(socket, ClientEvent.PLAYER_RESYNC, EmptySchema, async () => {
      const st = await getRoom(ctx.gameId);
      if (st) socket.emit(ServerEvent.ROOM_STATE, engine.snapshotFor(st));
      return { ok: true };
    });

    on(socket, ClientEvent.GAME_START, EmptySchema, async () => {
      await engine.startGame(ctx.gameId);
      return { ok: true };
    });

    on(socket, ClientEvent.ROUND_NEXT, EmptySchema, async () => {
      await engine.startNextRound(ctx.gameId);
      return { ok: true };
    });

    on(socket, ClientEvent.GAME_PAUSE, EmptySchema, async () => {
      await engine.pauseGame(ctx.gameId);
      return { ok: true };
    });

    on(socket, ClientEvent.GAME_RESUME, EmptySchema, async () => {
      await engine.resumeGame(ctx.gameId);
      return { ok: true };
    });

    on(socket, ClientEvent.PLAYER_KICK, PlayerKickSchema, async (input) => {
      await engine.kickPlayer(ctx.gameId, input.participantId);
      return { ok: true };
    });

    on(socket, ClientEvent.GAME_END, EmptySchema, async () => {
      await engine.endGame(ctx.gameId);
      return { ok: true };
    });

    // Seen-Jeem: host accepts/rejects a spoken answer for the open cell.
    on(socket, ClientEvent.SJ_ADJUDICATE, AdjudicateSchema, async (input) => {
      await sj.adjudicate(ctx.gameId, input.cellId, input.correct);
      return { ok: true };
    });

    socket.on('disconnect', async () => {
      // Host dropping pauses the game so progress isn't lost (doc 01 §7) — but only
      // after a grace period, so a quick background/reconnect doesn't pause at all.
      const s = await getRoom(ctx.gameId);
      // Ignore stale sockets: only the *current* host arms the timer.
      if (!s || s.status !== 'ACTIVE' || s.hostSocketId !== socket.id) return;

      const existing = hostGraceTimers.get(ctx.gameId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        void (async () => {
          hostGraceTimers.delete(ctx.gameId);
          const cur = await getRoom(ctx.gameId);
          // Still active and still no reconnected host → pause now.
          if (cur && cur.status === 'ACTIVE' && cur.hostSocketId === socket.id) {
            pausedByDisconnect.add(ctx.gameId);
            await engine.pauseGame(ctx.gameId); // emits GAME_PAUSED
          }
        })();
      }, HOST_GRACE_MS);
      hostGraceTimers.set(ctx.gameId, timer);
    });
  });
}
