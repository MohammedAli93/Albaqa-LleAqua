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

export function registerScreenNamespace(screenNs: Namespace): void {
  screenNs.use(screenAuth);

  screenNs.on('connection', async (socket: Socket) => {
    const ctx = socket.ctx as ScreenSocketData;
    socket.join(roomName(ctx.gameId));

    // Track host socket + send full snapshot.
    const state = await getRoom(ctx.gameId);
    if (state) {
      state.hostSocketId = socket.id;
      await saveRoom(state);
      socket.emit(ServerEvent.ROOM_STATE, engine.snapshotFor(state));
    }

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
      // Host dropping pauses the game so progress isn't lost (doc 01 §7).
      const s = await getRoom(ctx.gameId);
      if (s && s.status === 'ACTIVE') {
        await engine.pauseGame(ctx.gameId);
        screenNs.to(roomName(ctx.gameId)).emit(ServerEvent.GAME_PAUSED, { reason: 'host-disconnected' });
      }
    });
  });
}
