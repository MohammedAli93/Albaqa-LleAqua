/** /play namespace — mobile controllers (one per player). */
import type { Namespace, Socket } from 'socket.io';
import {
  ClientEvent,
  ServerEvent,
  PlayerJoinSchema,
  PickTeamSchema,
  PickCategorySchema,
  PlayerAnswerSchema,
  EmptySchema,
  DraftPickSchema,
  CellSelectSchema,
  LifelineUseSchema,
  TeamAnswerSchema,
} from '@tahaddi/shared';
import { env } from '../../config/env.js';
import { playAuth } from '../middleware/auth.js';
import { on } from '../handlerUtil.js';
import { roomName } from '../emitter.js';
import * as engine from '../../domain/game/engine.js';
import * as sj from '../../domain/game/seenJeemEngine.js';
import { getRoom } from '../../domain/rooms/roomStore.js';
import { hashCapabilityToken } from '../../domain/auth/tokens.js';
import type { PlaySocketData } from '../socketContext.js';

export function registerPlayNamespace(playNs: Namespace): void {
  playNs.use(playAuth);

  playNs.on('connection', async (socket: Socket) => {
    const ctx = socket.ctx as PlaySocketData;
    socket.join(roomName(ctx.gameId));

    // Reconnect path: client presented a sessionToken in the handshake.
    const sessionToken = socket.handshake.auth.sessionToken as string | undefined;
    if (sessionToken) {
      const res = await engine.reconnect(ctx.gameId, hashCapabilityToken(sessionToken), socket.id);
      if (res) {
        ctx.participantId = res.participant.id;
        socket.emit(ServerEvent.ROOM_STATE, engine.snapshotFor(res.state, res.participant.id));
      }
    } else {
      // Fresh connection: send lobby snapshot so the join screen can render.
      const state = await getRoom(ctx.gameId);
      if (state) socket.emit(ServerEvent.ROOM_STATE, engine.snapshotFor(state));
    }

    on(socket, ClientEvent.PLAYER_JOIN, PlayerJoinSchema, async (input) => {
      const { participantId, sessionToken: token, state } = await engine.join(ctx.gameId, input, socket.id);
      ctx.participantId = participantId;
      socket.emit(ServerEvent.ROOM_STATE, engine.snapshotFor(state, participantId));
      return { participantId, sessionToken: token };
    });

    on(socket, ClientEvent.PLAYER_PICK_TEAM, PickTeamSchema, async (input) => {
      if (!ctx.participantId) throw new Error('not joined');
      await engine.pickTeam(ctx.gameId, ctx.participantId, input.teamId);
      return { ok: true };
    });

    on(socket, ClientEvent.PLAYER_PICK_CATEGORY, PickCategorySchema, async (input) => {
      if (!ctx.participantId) throw new Error('not joined');
      await engine.pickCategory(ctx.gameId, ctx.participantId, input.categoryId);
      return { ok: true };
    });

    on(socket, ClientEvent.PLAYER_ANSWER, PlayerAnswerSchema, async (input) => {
      if (!ctx.participantId) throw new Error('not joined');
      return engine.submitAnswer(ctx.gameId, ctx.participantId, input.roundId, input.optionId);
    });

    // ── Seen-Jeem intents (any active member acts on their team's behalf) ──
    on(socket, ClientEvent.SJ_DRAFT_PICK, DraftPickSchema, async (input) => {
      const teamId = await sj.teamOf(ctx.gameId, ctx.participantId);
      await sj.draftPick(ctx.gameId, teamId, input.categoryId);
      return { ok: true };
    });

    on(socket, ClientEvent.SJ_CELL_SELECT, CellSelectSchema, async (input) => {
      const teamId = await sj.teamOf(ctx.gameId, ctx.participantId);
      await sj.cellSelect(ctx.gameId, teamId, input.cellId);
      return { ok: true };
    });

    on(socket, ClientEvent.SJ_LIFELINE_USE, LifelineUseSchema, async (input) => {
      const teamId = await sj.teamOf(ctx.gameId, ctx.participantId);
      await sj.lifelineUse(ctx.gameId, teamId, input.lifeline);
      return { ok: true };
    });

    on(socket, ClientEvent.SJ_TEAM_ANSWER, TeamAnswerSchema, async (input) => {
      const teamId = await sj.teamOf(ctx.gameId, ctx.participantId);
      await sj.teamAnswer(ctx.gameId, teamId, input.cellId, input.optionId);
      return { ok: true };
    });

    on(socket, ClientEvent.PLAYER_HEARTBEAT, EmptySchema, async () => ({ serverTs: Date.now() }));

    on(socket, ClientEvent.PLAYER_LEAVE, EmptySchema, async () => {
      if (ctx.participantId) await engine.leave(ctx.gameId, ctx.participantId);
      return { ok: true };
    });

    socket.on('disconnect', async () => {
      if (!ctx.participantId) return;
      // Grace window: mark disconnected, broadcast left only if they don't return.
      await engine.markDisconnected(ctx.gameId, ctx.participantId);
      const grace = env.GAME_RECONNECT_GRACE_SEC * 1000;
      setTimeout(async () => {
        const state = await getRoom(ctx.gameId);
        const p = state?.participants[ctx.participantId!];
        if (p && p.status === 'DISCONNECTED' && p.disconnectedAt && Date.now() - p.disconnectedAt >= grace) {
          await engine.leave(ctx.gameId, ctx.participantId!);
        }
      }, grace + 500);
    });
  });
}
