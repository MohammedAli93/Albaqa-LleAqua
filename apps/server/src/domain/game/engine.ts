/**
 * Game engine — orchestrates the authoritative game loop. Operates on RoomState
 * (Redis), persists milestones to Postgres, runs scoring (pure), schedules timers,
 * and emits via the injected GameEmitter port. All mutating round resolution runs
 * under a Redis lock so a timer-fire and a last-answer can't double-resolve.
 */
import { nanoid } from 'nanoid';
import {
  AppError,
  ErrorCode,
  GameStatus,
  GameType,
  GameMode,
  GameTier,
  RoundPhase,
  ParticipantStatus,
  ServerEvent,
  type PlayerJoinInput,
  type GameCompletedPayload,
  type RoundHero,
} from '@tahaddi/shared';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { withRoomLock, acquireRoomLock } from './lock.js';
import { setEmitter } from './emitterRef.js';
import { startSeenJeem } from './seenJeemEngine.js';
import { getRoom, saveRoom, deleteRoom } from '../rooms/roomStore.js';
import type { RoomState, LiveParticipant, LiveTeam, LiveRound } from '../rooms/types.js';
import { hashCapabilityToken, generateCapabilityToken, verifyPlayerToken } from '../auth/tokens.js';
import { loadQuestion } from '../content/questionLoader.js';
import { isValidAvatarId } from '@tahaddi/shared';
import {
  scoreRound,
  applyResolution,
  evaluateWinCondition,
  activeParticipants,
  topContenders,
  decideTiebreak,
  compareSurvival,
  isEliminationSuddenDeath,
} from './scoring.js';
import {
  buildSnapshot,
  buildLeaderboard,
  toPublicParticipant,
  publicTeams,
} from './snapshot.js';
import { teamLeaderId, ensureTeamLeaders } from './teams.js';
import * as fsm from './fsm.js';
import { profileStatUpdates } from './profileStats.js';
import { buildPerPlayerOrder, pickCategoryQuestion, pickAnyUnusedQuestion } from '../rooms/roomService.js';
import { consumeCredit, refundCredit } from '../payments/paymentService.js';
import {
  scheduleRoundEnd,
  clearRoundTimer,
  scheduleTicks,
  clearTicks,
} from './timer.js';
import type { GameEmitter } from './ports.js';

let emitter: GameEmitter;
export function initEngine(e: GameEmitter): void {
  emitter = e;
  setEmitter(e); // shared with the Seen-Jeem orchestrator
}

/** "Get ready" countdown before every question opens for answering (3-2-1).
 *  This is the client-visible "next question in N" lead-in before each question,
 *  including the very first one after the host starts. Client feedback 2026-07-23:
 *  the first question appeared too abruptly → raised to 5s (client 2026-07-23:
 *  transition still felt fast, wants ~5s) so every question (especially the
 *  first) leads in with a visible countdown. */
const GET_READY_MS = 5000;

// ─────────────────────────────── Join / leave ───────────────────────────────

export interface JoinResult {
  participantId: string;
  sessionToken: string;
  state: RoomState;
}

/** Prisma's "unique constraint failed" (P2002), whatever wrapper it arrives in. */
function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === 'P2002';
}

/**
 * Free a nickname still held by a player who LEFT the room. `Participant` is
 * unique per (gameId, nickname), so without this a player who dropped out and came
 * back under the same name hit a P2002 and the phone hung on «جاري الدخول».
 * The abandoned row is renamed to a tombstone (kept for the game's answer history)
 * and dropped from the live room.
 */
async function releaseNickname(state: RoomState, nickname: string): Promise<void> {
  const lower = nickname.toLowerCase();
  const stale = Object.values(state.participants).filter(
    (p) => p.status === ParticipantStatus.LEFT && p.nickname.toLowerCase() === lower,
  );
  for (const p of stale) {
    await prisma.participant
      .update({ where: { id: p.id }, data: { nickname: `${p.nickname} (خرج ${p.id.slice(0, 6)})` } })
      .catch(() => {});
    delete state.participants[p.id];
  }
}

export async function join(
  gameId: string,
  input: PlayerJoinInput,
  socketId: string,
): Promise<JoinResult> {
  if (!isValidAvatarId(input.avatarId)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Unknown avatar');
  }
  const nickname = input.nickname.trim();
  const sessionToken = generateCapabilityToken();
  const sessionTokenHash = hashCapabilityToken(sessionToken);

  // If the player joined while logged in, link this participation to their
  // account so wins / games-played accrue to the profile when the game ends.
  // A bad/expired token is ignored (the player still joins as a guest).
  let playerId: string | undefined;
  if (input.playerToken) {
    try {
      playerId = verifyPlayerToken(input.playerToken).sub;
    } catch {
      playerId = undefined;
    }
  }

  // The whole read-modify-write runs under the room lock so concurrent joins
  // (e.g. a stampede when a show starts) can't clobber each other's writes.
  const { participant, state, playerCount } = await withRoomLock(gameId, async () => {
    const state = await mustGetRoom(gameId);
    fsm.assertJoinable(state);

    const visible = Object.values(state.participants).filter((p) => p.status !== ParticipantStatus.LEFT);
    if (visible.length >= state.settings.maxPlayers) {
      throw new AppError(ErrorCode.ROOM_FULL, 'Room is full');
    }
    if (visible.some((p) => p.nickname.toLowerCase() === nickname.toLowerCase())) {
      throw new AppError(ErrorCode.NICKNAME_TAKEN, 'Nickname already taken');
    }
    // Somebody who LEFT still owns this nickname in the DB (Participant is unique
    // per game+nickname). They're gone from the room, so hand the name back: retire
    // the abandoned row under a tombstone name rather than letting the insert blow
    // up with P2002 and freeze the joining phone (client 2026-08-30).
    await releaseNickname(state, nickname);

    // Monotonic, never reused: `releaseNickname` can delete a row above, so the
    // plain participant count would hand out an order another player already has —
    // and joinOrder is the final tiebreaker for ranking and team-leader order.
    const joinOrder =
      Object.values(state.participants).reduce((max, p) => Math.max(max, p.joinOrder), -1) + 1;
    const dbParticipant = await prisma.participant
      .create({
        data: {
          gameId,
          nickname,
          avatarId: input.avatarId,
          status: ParticipantStatus.ACTIVE,
          score: 0,
          lives: state.settings.livesPerPlayer,
          joinOrder,
          sessionToken: sessionTokenHash,
          ...(playerId ? { playerId } : {}),
        },
      })
      .catch((err: unknown) => {
        // Last line of defence: a unique-constraint clash must surface as a clean
        // "name taken" the join screen can show, never as an unhandled crash.
        if (isUniqueViolation(err)) {
          throw new AppError(ErrorCode.NICKNAME_TAKEN, 'Nickname already taken');
        }
        throw err;
      });

    const participant: LiveParticipant = {
      id: dbParticipant.id,
      nickname,
      avatarId: input.avatarId,
      status: ParticipantStatus.ACTIVE,
      score: 0,
      lives: state.settings.livesPerPlayer,
      joinOrder,
      correctCount: 0,
      speedMs: 0,
      sessionTokenHash,
      ...(playerId ? { playerId } : {}),
      socketId,
    };
    state.participants[participant.id] = participant;
    await saveRoom(state);
    return { participant, state, playerCount: visible.length + 1 };
  });

  emitter.toRoom(gameId, ServerEvent.PLAYER_JOINED, {
    participant: toPublicParticipant(participant),
    playerCount,
  });

  return { participantId: participant.id, sessionToken, state };
}

/** Count active+disconnected members currently on a team (excludes LEFT). */
function teamMemberCount(state: RoomState, teamId: string): number {
  return Object.values(state.participants).filter(
    (p) => p.teamId === teamId && p.status !== ParticipantStatus.LEFT,
  ).length;
}

/** The team with the fewest members that still has free capacity. */
function leastFullTeam(state: RoomState): LiveTeam | undefined {
  return Object.values(state.teams)
    .filter((t) => teamMemberCount(state, t.id) < (t.capacity ?? Infinity))
    .sort((a, b) => teamMemberCount(state, a.id) - teamMemberCount(state, b.id))[0];
}

/**
 * TEAMS lobby: a player claims a seat on a specific team. Enforces capacity and
 * lets a player switch teams before the game starts. Broadcasts a fresh snapshot.
 */
export async function pickTeam(
  gameId: string,
  participantId: string,
  teamId: string,
): Promise<RoomState> {
  const state = await withRoomLock(gameId, async () => {
    const state = await mustGetRoom(gameId);
    if (state.type !== GameType.TEAMS) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'هذه اللعبة ليست جماعية');
    }
    if (state.status !== GameStatus.LOBBY) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'لا يمكن تغيير الفريق بعد بدء اللعبة');
    }
    const participant = state.participants[participantId];
    if (!participant) throw new AppError(ErrorCode.NOT_AUTHORIZED, 'لست لاعباً في هذه الغرفة');
    const team = state.teams[teamId];
    if (!team) throw new AppError(ErrorCode.NOT_FOUND, 'الفريق غير موجود');

    if (
      participant.teamId !== teamId &&
      team.capacity != null &&
      teamMemberCount(state, teamId) >= team.capacity
    ) {
      throw new AppError(ErrorCode.CONFLICT, 'الفريق ممتلئ');
    }
    participant.teamId = teamId;
    // First one in leads by default, and a team whose leader just switched sides
    // gets a new one — so no team is ever left without someone to answer for it.
    ensureTeamLeaders(state);
    await prisma.participant.update({ where: { id: participantId }, data: { teamId } });
    await saveRoom(state);
    return state;
  });
  emitter.toRoom(gameId, ServerEvent.ROOM_STATE, buildSnapshot(state));
  return state;
}

/**
 * TEAMS mode: the host names which member answers for a team. Allowed while the
 * game is live too — a leader whose phone died shouldn't cost the team the match.
 */
export async function setTeamLeader(
  gameId: string,
  teamId: string,
  participantId: string,
): Promise<RoomState> {
  const state = await withRoomLock(gameId, async () => {
    const state = await mustGetRoom(gameId);
    const team = state.teams[teamId];
    if (!team) throw new AppError(ErrorCode.NOT_FOUND, 'الفريق غير موجود');
    const participant = state.participants[participantId];
    if (!participant || participant.status === ParticipantStatus.LEFT) {
      throw new AppError(ErrorCode.NOT_FOUND, 'اللاعب غير موجود');
    }
    if (participant.teamId !== teamId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'هذا اللاعب ليس في هذا الفريق');
    }
    team.leaderId = participantId;
    await saveRoom(state);
    return state;
  });
  emitter.toRoom(gameId, ServerEvent.ROOM_STATE, buildSnapshot(state));
  return state;
}

/** Per-player-category mode: a player chooses their own category in the lobby. */
export async function pickCategory(
  gameId: string,
  participantId: string,
  categoryId: string,
): Promise<RoomState> {
  const state = await withRoomLock(gameId, async () => {
    const state = await mustGetRoom(gameId);
    if (!state.settings.perPlayerCategory) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'اختيار الفئة لكل لاعب غير مفعّل');
    }
    if (state.status !== GameStatus.LOBBY) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'لا يمكن تغيير الفئة بعد بدء اللعبة');
    }
    const participant = state.participants[participantId];
    if (!participant) throw new AppError(ErrorCode.NOT_AUTHORIZED, 'لست لاعباً في هذه الغرفة');
    // Categories are claimed exclusively: a category another active player already
    // holds can't be taken. (Re-picking your own current category is a no-op.)
    const taken = Object.values(state.participants).some(
      (p) =>
        p.id !== participantId &&
        p.status !== ParticipantStatus.LEFT &&
        p.categoryId === categoryId,
    );
    if (taken) {
      throw new AppError(ErrorCode.CONFLICT, 'هذه الفئة اختارها لاعب آخر، اختر فئة أخرى');
    }
    participant.categoryId = categoryId;
    await saveRoom(state);
    return state;
  });
  emitter.toRoom(gameId, ServerEvent.ROOM_STATE, buildSnapshot(state));
  return state;
}

/** Rebind a reconnecting socket to its participant by session token hash. */
export async function reconnect(
  gameId: string,
  sessionTokenHash: string,
  socketId: string,
): Promise<{ state: RoomState; participant: LiveParticipant } | null> {
  const result = await withRoomLock(gameId, async () => {
    const state = await mustGetRoom(gameId);
    const participant = Object.values(state.participants).find(
      (p) => p.sessionTokenHash === sessionTokenHash && p.status !== ParticipantStatus.LEFT,
    );
    if (!participant) return null;

    const wasDisconnected = participant.status === ParticipantStatus.DISCONNECTED;
    participant.socketId = socketId;
    participant.disconnectedAt = undefined;
    if (participant.status === ParticipantStatus.DISCONNECTED) {
      participant.status = ParticipantStatus.ACTIVE;
    }
    await saveRoom(state);
    return { state, participant, wasDisconnected };
  });
  if (!result) return null;

  if (result.wasDisconnected) {
    emitter.toRoom(gameId, ServerEvent.PLAYER_RECONNECTED, { participantId: result.participant.id });
    // The leader badge may move back to them now that they're live again.
    if (result.state.type === GameType.TEAMS) {
      emitter.toRoom(gameId, ServerEvent.ROOM_STATE, buildSnapshot(result.state));
    }
  }
  return { state: result.state, participant: result.participant };
}

/** Mark a participant disconnected (grace window handled by caller). */
export async function markDisconnected(gameId: string, participantId: string): Promise<void> {
  const state = await withRoomLock(gameId, async () => {
    const state = await getRoom(gameId);
    if (!state) return null;
    const p = state.participants[participantId];
    if (!p || p.status === ParticipantStatus.LEFT) return null;
    if (p.status === ParticipantStatus.ACTIVE) p.status = ParticipantStatus.DISCONNECTED;
    p.disconnectedAt = Date.now();
    p.socketId = undefined;
    await saveRoom(state);
    return state;
  }).catch(() => null);
  // TEAMS: a dropped leader is covered by the next active member, so tell the room
  // who is answering now (the badge returns to the leader when they reconnect).
  if (state && state.type === GameType.TEAMS) {
    emitter.toRoom(gameId, ServerEvent.ROOM_STATE, buildSnapshot(state));
  }
}

export async function leave(gameId: string, participantId: string): Promise<void> {
  const result = await withRoomLock(gameId, async () => {
    const state = await getRoom(gameId);
    if (!state) return null;
    const p = state.participants[participantId];
    if (!p) return null;
    p.status = ParticipantStatus.LEFT;
    p.socketId = undefined;
    // If the team's leader walked out, hand the role to the next member — the
    // team must always have someone who can answer.
    ensureTeamLeaders(state);
    await saveRoom(state);
    return {
      playerCount: Object.values(state.participants).filter((x) => x.status !== ParticipantStatus.LEFT).length,
      state,
    };
  });
  if (!result) return;
  emitter.toRoom(gameId, ServerEvent.PLAYER_LEFT, { participantId, playerCount: result.playerCount });
  // Teams carry the leader badge, so push a fresh snapshot: the promoted member's
  // phone has to learn it is now the one answering.
  if (result.state.type === GameType.TEAMS) {
    emitter.toRoom(gameId, ServerEvent.ROOM_STATE, buildSnapshot(result.state));
  }
}

// ──────────────────────────────── Start game ────────────────────────────────

/**
 * Spend one game-credit for a PAID individual game, at the moment the host starts
 * it. Idempotent: the credit is only taken if Game.creditChargedAt is still null,
 * and that stamp is written in the same conditional update that decrements, so a
 * double-start (or a retry after a network blip) can't charge twice.
 */
async function chargeCreditIfNeeded(state: RoomState): Promise<void> {
  // Every PAID game costs one credit, whatever the format — «تُستخدم اللعبة
  // الواحدة لبدء مباراة كاملة بالنظام الذي تختاره» (client 2026-08-28). Teams
  // used to slip through this check and got the full bank for free.
  if (state.settings.tier !== GameTier.PAID || !state.hostPlayerId) return;

  // Already paid for (this room was started before, or created under the old
  // charge-on-create rule) → nothing to do.
  const row = await prisma.game.findUnique({
    where: { id: state.gameId },
    select: { creditChargedAt: true },
  });
  if (row?.creditChargedAt) return;

  const claimed = await prisma.game.updateMany({
    where: { id: state.gameId, creditChargedAt: null },
    data: { creditChargedAt: new Date() },
  });
  if (claimed.count === 0) return; // another start won the race and paid already

  if (!(await consumeCredit(state.hostPlayerId))) {
    // Out of credits: release the claim so a later start (after a top-up) can pay.
    await prisma.game.update({ where: { id: state.gameId }, data: { creditChargedAt: null } });
    throw new AppError(ErrorCode.PAYMENT_REQUIRED, 'تحتاج رصيد لعبة لبدء لعبة النسخة الكاملة');
  }
}

export async function startGame(gameId: string): Promise<void> {
  const state = await mustGetRoom(gameId);
  fsm.assertStartable(state);
  fsm.assertTransition(state.status, GameStatus.ACTIVE);

  // Charge the paid game-credit HERE — the game is only "played" once it starts.
  // Creating a room, sharing the link and then abandoning it costs nothing, and a
  // host who has to re-create a room isn't billed twice. creditChargedAt makes it
  // idempotent, so a retried start can never double-charge.
  await chargeCreditIfNeeded(state);

  // Seen-Jeem is a different format (turn-based board, not simultaneous rounds);
  // hand off to its orchestrator, which owns its own loop.
  if (state.mode === GameMode.SEEN_JEEM) {
    await startSeenJeem(gameId);
    return;
  }

  // Teams were created in the lobby and players picked their teams. Auto-fill any
  // who never picked into the least-full team so nobody is left out, then persist.
  if (state.type === GameType.TEAMS) {
    const teamIds = Object.keys(state.teams);
    if (teamIds.length === 0) throw new AppError(ErrorCode.CONFLICT, 'لا توجد فرق في هذه اللعبة');
    const unassigned = Object.values(state.participants)
      .filter((p) => p.status === ParticipantStatus.ACTIVE && !p.teamId)
      .sort((a, b) => a.joinOrder - b.joinOrder);
    for (const p of unassigned) {
      const target = leastFullTeam(state);
      if (target) p.teamId = target.id;
    }
    await prisma.$transaction(
      Object.values(state.participants)
        .filter((p) => p.teamId)
        .map((p) => prisma.participant.update({ where: { id: p.id }, data: { teamId: p.teamId } })),
    );
    // Everyone is on a team now — stamp the leaders (auto-filled players included)
    // so every team goes into the game with exactly one member who answers for it.
    ensureTeamLeaders(state);
    // Freeze the turn order now. Team points games are turn-based: question N is
    // asked to teamOrder[N % teams], and a missed question is offered to the next
    // team in the ring. Frozen (not re-derived) so a reconnect can't reshuffle
    // whose turn it is mid-game.
    state.teamOrder = teamIds;
  }

  // Per-player-category mode: build the round order now that everyone has joined
  // and (mostly) picked. Rounds rotate through players, each from their category.
  if (state.settings.perPlayerCategory) {
    const players = Object.values(state.participants)
      .filter((p) => p.status === ParticipantStatus.ACTIVE)
      .sort((a, b) => a.joinOrder - b.joinOrder)
      .map((p) => ({ id: p.id, categoryId: p.categoryId }));
    const target = state.settings.totalRounds ?? 35;
    const { questionOrder, roundOwners } = await buildPerPlayerOrder(players, target);
    if (questionOrder.length >= 1) {
      state.questionOrder = questionOrder;
      state.roundOwners = roundOwners;
      state.totalRounds = questionOrder.length;
    } else {
      // Safety net: fall back to the package so the game is always playable.
      const pkgQs = await prisma.packageQuestion.findMany({
        where: { packageId: state.packageId },
        orderBy: { order: 'asc' },
        select: { questionId: true },
      });
      state.questionOrder = pkgQs.map((q) => q.questionId);
      state.totalRounds = state.questionOrder.length;
    }
  }

  state.status = GameStatus.ACTIVE;
  state.startedAt = Date.now();
  state.roundIndex = -1;
  await prisma.game.update({
    where: { id: gameId },
    data: { status: GameStatus.ACTIVE, startedAt: new Date() },
  });
  await saveRoom(state);

  // TEAMS: push the settled rosters before the first question — auto-filled players
  // learn which team they're on, and every phone learns who its leader is.
  if (state.type === GameType.TEAMS) {
    emitter.toRoom(gameId, ServerEvent.ROOM_STATE, buildSnapshot(state));
  }

  emitter.toRoom(gameId, ServerEvent.GAME_STARTED, {
    totalRounds: state.totalRounds,
    type: state.type,
    mode: state.mode,
    settings: state.settings,
  });

  await startNextRound(gameId);
}

// ─────────────────────────── Team turns (TEAMS points) ──────────────────────
//
// Client rule (2026-08-06): a team game is turn-based, not a race. Each question
// belongs to ONE team. Answer it right and play moves on to the other team's own
// question. Answer it wrong (or let the clock run out) and the SAME question is
// re-opened for the other team as a steal — worth the full point — after which
// that team still gets its own next question. Net effect: the turn simply
// alternates every question, and a miss hands the other team a free extra shot.

/** Is this a turn-based team game (TEAMS + POINTS)? Seen-Jeem runs its own loop. */
function isTeamTurnGame(state: RoomState): boolean {
  return state.type === GameType.TEAMS && state.mode === GameMode.POINTS;
}

/** The turn ring, falling back to the live team map for pre-existing rooms. */
function turnRing(state: RoomState): string[] {
  const ring = state.teamOrder?.filter((id) => state.teams[id]);
  return ring?.length ? ring : Object.keys(state.teams);
}

/** Which team is asked question `index` (0-based). */
function teamForRound(state: RoomState, index: number): string | undefined {
  const ring = turnRing(state);
  if (!ring.length) return undefined;
  return ring[((index % ring.length) + ring.length) % ring.length];
}

/** Who gets the steal when `teamId` misses — the next team in the ring. */
function stealTeamFor(state: RoomState, teamId: string): string | undefined {
  const ring = turnRing(state);
  if (ring.length < 2) return undefined;
  const i = ring.indexOf(teamId);
  if (i < 0) return undefined;
  return ring[(i + 1) % ring.length];
}

/** Between-round window in ms (answer recap + standings). */
function nextInMsFor(state: RoomState): number {
  return state.settings.intermissionSec * 1000;
}

/** Public descriptor of the team on the clock, for QUESTION_SHOW. */
function turnTeamPayload(
  state: RoomState,
  teamId: string | undefined,
): { turnTeam: { teamId: string; name: string; color: string } } | Record<string, never> {
  const team = teamId ? state.teams[teamId] : undefined;
  return team ? { turnTeam: { teamId: team.id, name: team.name, color: team.color } } : {};
}

/**
 * The round loop failed on a background timer. Nobody is left to retry it, so the
 * game would sit frozen mid-round with the host's game-credit already spent.
 *
 * A single failure is usually transient (a DB blip on the Round insert, a slow
 * question load), and killing a live match for one hiccup is worse than the freeze
 * it prevents — so we retry the loop ONCE after a short pause. Only if that retry
 * also fails is the game genuinely unrunnable: then it is aborted, which refunds
 * the credit (client 2026-08-30).
 */
const ROUND_RETRY_MS = 2000;
function onRoundFailure(gameId: string, err: unknown, where: string): void {
  logger.error({ err, gameId }, where);
  setTimeout(() => {
    void (async () => {
      const cur = await getRoom(gameId);
      // Already gone, already over, or paused (the host will resume) — nothing to do.
      if (!cur || cur.status !== GameStatus.ACTIVE) return;
      try {
        if (cur.pendingSteal) await startStealRound(gameId, cur.pendingSteal);
        else await startNextRound(gameId);
        logger.warn({ gameId, where }, 'round loop recovered on retry');
      } catch (retryErr) {
        logger.error({ err: retryErr, gameId, where }, 'round loop retry failed — aborting');
        await abortGame(gameId, where).catch((e) =>
          logger.error({ err: e, gameId }, 'abort after round failure failed'),
        );
      }
    })().catch((e) => logger.error({ err: e, gameId }, 'round failure handler crashed'));
  }, ROUND_RETRY_MS);
}

// ──────────────────────────────── Round loop ────────────────────────────────

export async function startNextRound(gameId: string): Promise<void> {
  const state = await mustGetRoom(gameId);

  // A queued team steal takes priority over a fresh question: the other team is
  // still owed its attempt at the question that was just missed. Covers the host
  // advancing manually (autoAdvance off) as well as any resumed loop.
  if (state.pendingSteal) {
    await startStealRound(gameId, state.pendingSteal);
    return;
  }

  // In sudden-death overtime the "next round" is always a tiebreaker question
  // (also covers a host who advances manually instead of auto-advance).
  if (state.tiebreak) {
    await startTiebreakRound(gameId);
    return;
  }

  // ELIMINATION never ends on a question count — keep the duel supplied with
  // questions until a single survivor remains.
  await ensureEliminationQuestion(state);

  const nextIndex = state.roundIndex + 1;

  if (nextIndex >= state.questionOrder.length) {
    // Out of scripted rounds → decide the winner, or open overtime on a tie.
    await concludeGame(gameId);
    return;
  }

  const questionId = state.questionOrder[nextIndex]!;
  const loaded = await loadQuestion(questionId);

  // Elimination used to narrow the options down to the number of survivors (2-3
  // players → 2-3 options). The client asked for one uniform rule instead: every
  // question shows all four options, whatever the player count. A single winner is
  // still guaranteed by the "never wipe everyone" safety net in scoring.

  // 3-2-1 "get ready" pre-roll: answering opens GET_READY_MS after the question is
  // pushed, so every round (including the first) leads in with a countdown. The
  // answer window + the resolution timer are measured from `startedAt`, so the
  // pre-roll never eats into anyone's answering time.
  const now = Date.now();
  const startedAt = now + GET_READY_MS;
  const timeLimitSec = loaded.timeLimitSec || state.settings.questionTimerSec;
  const endsAt = startedAt + timeLimitSec * 1000;
  const roundId = nanoid(16);

  // Durable round record.
  await prisma.round.create({
    data: {
      id: roundId,
      gameId,
      index: nextIndex,
      questionId,
      startedAt: new Date(startedAt),
      correctOptionId: loaded.correctOptionId,
    },
  });

  state.roundIndex = nextIndex;
  state.lastHeroes = undefined; // cleared each round; set again on resolution
  state.currentRound = {
    roundId,
    index: nextIndex,
    questionId,
    correctOptionId: loaded.correctOptionId,
    question: loaded.publicQuestion,
    startedAt,
    endsAt,
    phase: RoundPhase.COLLECTING,
    timeLimitSec,
    basePoints: loaded.basePoints,
    speedBonus: loaded.speedBonus,
    answers: {},
    // TEAMS points: this question belongs to exactly one team; only they may answer.
    ...(isTeamTurnGame(state) ? { answeringTeamId: teamForRound(state, nextIndex) } : {}),
  };
  await saveRoom(state);

  const ownerId = state.roundOwners?.[nextIndex];
  const owner = ownerId ? state.participants[ownerId] : undefined;
  emitter.toRoom(gameId, ServerEvent.QUESTION_SHOW, {
    round: nextIndex + 1,
    roundId,
    question: loaded.publicQuestion,
    startsAt: startedAt,
    endsAt,
    // An elimination duel this far past its scripted length is settled on speed —
    // flag it so both screens show the decisive-question badge.
    ...(isEliminationSuddenDeath(state, nextIndex) ? { tiebreak: true } : {}),
    ...(owner ? { turnPlayer: { nickname: owner.nickname, avatarId: owner.avatarId } } : {}),
    ...turnTeamPayload(state, state.currentRound.answeringTeamId),
  });

  // Countdown ticks (≈4 Hz) + the authoritative resolution at endsAt.
  scheduleTicks(gameId, endsAt, (remainingMs) =>
    emitter.toRoom(gameId, ServerEvent.TIMER_TICK, { roundId, remainingMs }),
  );
  scheduleRoundEnd(gameId, endsAt, () =>
    void resolveRound(gameId).catch((err) => onRoundFailure(gameId, err, 'resolve on timer failed')),
  );
}

/**
 * TEAMS points: re-open the round's question for the other team after the team
 * that owned it missed. Same question, same Round row (and therefore the same
 * roundId) — a steal is a second attempt at one question, not a new one, so it
 * never consumes a question from `questionOrder` nor advances `roundIndex`.
 *
 * Reusing the Round row is safe because `baseOutcomes` only records the team on
 * the clock, so the two attempts write Answer rows for disjoint participants
 * (Answer is unique per round+participant).
 */
async function startStealRound(gameId: string, stealTeamId: string): Promise<void> {
  const state = await mustGetRoom(gameId);
  const prev = state.currentRound;
  if (!prev) return;
  state.pendingSteal = undefined; // claimed

  const now = Date.now();
  const startedAt = now + GET_READY_MS;
  const endsAt = startedAt + prev.timeLimitSec * 1000;

  state.lastHeroes = undefined;
  state.currentRound = {
    ...prev,
    startedAt,
    endsAt,
    phase: RoundPhase.COLLECTING,
    answers: {},
    answeringTeamId: stealTeamId,
    isSteal: true,
  };
  await saveRoom(state);

  emitter.toRoom(gameId, ServerEvent.QUESTION_SHOW, {
    round: prev.index + 1,
    roundId: prev.roundId,
    question: prev.question,
    startsAt: startedAt,
    endsAt,
    steal: true,
    ...turnTeamPayload(state, stealTeamId),
  });

  scheduleTicks(gameId, endsAt, (remainingMs) =>
    emitter.toRoom(gameId, ServerEvent.TIMER_TICK, { roundId: prev.roundId, remainingMs }),
  );
  scheduleRoundEnd(gameId, endsAt, () =>
    void resolveRound(gameId).catch((err) => onRoundFailure(gameId, err, 'resolve steal on timer failed')),
  );
}

// ──────────────────────────────── Answer ────────────────────────────────────

export interface AnswerResult {
  accepted: boolean;
  lockedAt: number;
}

export async function submitAnswer(
  gameId: string,
  participantId: string,
  roundId: string,
  optionId: string,
): Promise<AnswerResult> {
  // Record the answer under the room lock so concurrent submissions (up to 100
  // players answering at once) don't clobber each other on the shared RoomState.
  const { result, shouldResolve, received } = await withRoomLock(gameId, async () => {
    const state = await mustGetRoom(gameId);
    const round = fsm.assertAnswerable(state, roundId);

    // Answering hasn't opened yet — still in the 3-2-1 pre-roll. Reject so a fast
    // client can't bank a 0ms response before the question is live.
    if (Date.now() < round.startedAt) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Round has not started yet');
    }

    const participant = state.participants[participantId];
    if (!participant || participant.status !== ParticipantStatus.ACTIVE) {
      throw new AppError(ErrorCode.NOT_AUTHORIZED, 'Not an active player');
    }
    // TEAMS points: the question belongs to one team — the others are spectators
    // this round. Enforced server-side so a tampered client can't answer out of turn.
    if (round.answeringTeamId && participant.teamId !== round.answeringTeamId) {
      throw new AppError(ErrorCode.NOT_AUTHORIZED, 'ليس دور فريقك في هذا السؤال');
    }
    // TEAMS: the leader answers for the team (client rule 2026-08-12). Teammates
    // advise out loud but never lock an answer — otherwise a four-player team could
    // split across all four options and score every single question.
    if (state.type === GameType.TEAMS && participant.teamId) {
      const leaderId = teamLeaderId(state, participant.teamId);
      if (leaderId && leaderId !== participantId) {
        throw new AppError(ErrorCode.NOT_AUTHORIZED, 'قائد الفريق وحده هو من يختار الإجابة');
      }
    }
    if (!round.question.options.some((o) => o.id === optionId)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Unknown option');
    }

    // Idempotent: a second submit returns the first (anti double-answer).
    const existing = round.answers[participantId];
    if (existing) {
      return { result: { accepted: true, lockedAt: existing.serverTs }, shouldResolve: false, received: null };
    }

    const serverTs = Date.now();
    round.answers[participantId] = { optionId, serverTs };
    await saveRoom(state);

    // Resolve early once everyone who COULD answer has. In a team turn round that
    // is just the team on the clock — waiting on the spectating team would stall
    // the round until the timer expired. And in TEAMS only the leader can answer at
    // all, so counting their teammates would leave the round hanging on the clock.
    const eligible = activeParticipants(state).filter((p) => {
      if (round.answeringTeamId && p.teamId !== round.answeringTeamId) return false;
      if (state.type === GameType.TEAMS && p.teamId) return teamLeaderId(state, p.teamId) === p.id;
      return true;
    });
    const answeredCount = Object.keys(round.answers).length;
    return {
      result: { accepted: true, lockedAt: serverTs },
      shouldResolve: answeredCount >= eligible.length,
      received: { answeredCount, totalActive: eligible.length },
    };
  });

  if (received) emitter.toRoom(gameId, ServerEvent.ANSWER_RECEIVED, received);

  // Trigger resolution OUTSIDE the lock (resolveRound takes the same lock).
  if (shouldResolve) {
    clearRoundTimer(gameId);
    void resolveRound(gameId).catch((err) => logger.error({ err, gameId }, 'early resolve failed'));
  }

  return result;
}

// ──────────────────────────────── Resolve ───────────────────────────────────

export async function resolveRound(gameId: string): Promise<void> {
  // Exactly-once: only one resolver does work (phase re-checked under the lock).
  // Retrying acquire so a timer-fire that collides with an in-flight answer waits
  // for the lock rather than silently dropping the resolution.
  const release = await acquireRoomLock(gameId);
  if (!release) return;
  try {
    const state = await getRoom(gameId);
    if (!state || !state.currentRound) return;
    const round = state.currentRound;
    if (round.phase !== RoundPhase.COLLECTING) return; // already resolved

    clearRoundTimer(gameId);
    clearTicks(gameId);
    round.phase = RoundPhase.LOCKED;
    emitter.toRoom(gameId, ServerEvent.ANSWER_LOCKED, { roundId: round.roundId });

    // Sudden-death overtime resolves on its own terms (fastest correct contender),
    // not via normal scoring/elimination.
    if (round.isTiebreak) {
      await resolveTiebreakRound(gameId, state, round);
      await release();
      return;
    }

    // Pure scoring.
    const scored = scoreRound(state, round);
    const { outcomes, heroes } = scored;
    const deltas: Record<string, number> = {};
    for (const o of outcomes) deltas[o.participantId] = o.pointsAwarded;
    const { eliminatedIds, stalemate } = applyResolution(state, round, scored);

    // TEAMS mode: surface who earned each team's point this round.
    const richHeroes: RoundHero[] = heroes.map((h) => {
      const p = state.participants[h.participantId]!;
      const team = state.teams[h.teamId]!;
      return {
        teamId: h.teamId,
        teamName: team.name,
        participantId: h.participantId,
        nickname: p.nickname,
        avatarId: p.avatarId,
        pointsAwarded: h.pointsAwarded,
      };
    });
    state.lastHeroes = richHeroes.length ? richHeroes : undefined;

    // TEAMS points: did the team on the clock miss, so the other team gets to steal
    // this same question? Decided HERE, before the reveal, because a pending steal
    // must NOT disclose the correct answer — the stealing team is about to answer
    // the very same question. The reveal happens after the steal resolves instead.
    const stealTeamId =
      isTeamTurnGame(state) && round.answeringTeamId && !round.isSteal && !heroes.length
        ? stealTeamFor(state, round.answeringTeamId)
        : undefined;

    round.phase = RoundPhase.RESOLVING;

    // Persist answers (one transaction = one milestone flush).
    await prisma.$transaction([
      ...outcomes.map((o) =>
        prisma.answer.create({
          data: {
            gameId,
            roundId: round.roundId,
            participantId: o.participantId,
            questionId: round.questionId,
            selectedOptionId: o.selectedOptionId,
            isCorrect: o.isCorrect,
            responseMs: o.responseMs,
            pointsAwarded: o.pointsAwarded,
          },
        }),
      ),
      prisma.round.update({ where: { id: round.roundId }, data: { endedAt: new Date() } }),
    ]);

    // Reveal — but ONLY when the question is finished with. If a steal is pending
    // the same question is about to be re-asked to the other team, so disclosing
    // the correct answer (or even the answer distribution) here would hand them the
    // point. The reveal is deferred to the steal's own resolution.
    if (!stealTeamId) {
      const distribution: Record<string, number> = {};
      for (const o of outcomes) {
        if (o.selectedOptionId) distribution[o.selectedOptionId] = (distribution[o.selectedOptionId] ?? 0) + 1;
      }
      // Everyone who answered correctly, ranked fastest → slowest. The reveal shows
      // the full list (not just the top 3) — `place` still marks 1st/2nd/3rd.
      const topAnswerers = outcomes
        .filter((o) => o.isCorrect)
        .sort((a, b) => a.responseMs - b.responseMs)
        .map((o, i) => {
          const p = state.participants[o.participantId]!;
          return { participantId: o.participantId, nickname: p.nickname, avatarId: p.avatarId, place: i + 1 };
        });

      const loaded = await loadQuestion(round.questionId).catch(() => null);
      emitter.toRoom(gameId, ServerEvent.QUESTION_REVEAL, {
        roundId: round.roundId,
        correctOptionId: round.correctOptionId,
        distribution,
        topAnswerers,
        explanationAr: loaded?.explanationAr,
        explanationEn: loaded?.explanationEn,
      });
    }

    // Personal results.
    for (const o of outcomes) {
      const p = state.participants[o.participantId];
      if (p?.socketId) {
        emitter.toSocket(p.socketId, ServerEvent.ANSWER_RESULT, {
          roundId: round.roundId,
          isCorrect: o.isCorrect,
          pointsAwarded: o.pointsAwarded,
          newScore: p.score,
          livesLeft: p.lives,
        });
      }
    }

    // TEAMS: announce the per-team first-correct heroes before the leaderboard.
    if (richHeroes.length) {
      emitter.toRoom(gameId, ServerEvent.TEAM_SCORED, {
        roundIndex: round.index + 1,
        heroes: richHeroes,
      });
    }

    // Leaderboard with deltas. TEAMS games also carry refreshed team totals so the
    // screen updates the team scores every round (the +1-per-round team scoring).
    emitter.toRoom(gameId, ServerEvent.SCORE_UPDATE, {
      leaderboard: buildLeaderboard(state, deltas),
      ...(state.type === GameType.TEAMS ? { teams: publicTeams(state) } : {}),
    });

    // Eliminations.
    if (eliminatedIds.length) {
      emitter.toRoom(gameId, ServerEvent.PLAYER_ELIMINATED, {
        participantIds: eliminatedIds,
        round: round.index + 1,
      });
      const board = buildLeaderboard(state);
      for (const id of eliminatedIds) {
        const p = state.participants[id];
        const rank = board.find((e) => e.participantId === id)?.rank ?? board.length;
        if (p?.socketId) {
          emitter.toSocket(p.socketId, ServerEvent.YOU_ELIMINATED, { finalRank: rank, finalScore: p.score });
        }
      }
    }

    await saveRoom(state);

    // TEAMS points: the team on the clock missed → hand the SAME question to the
    // other team as a steal. Checked BEFORE the win condition so a miss on the very
    // last question still gets stolen rather than ending the game early. The steal
    // reuses this round (no question is consumed, `roundIndex` doesn't move), so
    // afterwards the normal alternation already puts the next question with the
    // other team — exactly the "ثم ننتقل للسؤال الثاني للفريق الثاني" rule.
    if (stealTeamId) {
      round.phase = RoundPhase.INTERMISSION;
      state.pendingSteal = stealTeamId;
      await saveRoom(state);
      const stealTeam = state.teams[stealTeamId];
      emitter.toRoom(gameId, ServerEvent.ROUND_COMPLETED, {
        roundIndex: round.index + 1,
        nextInMs: state.settings.autoAdvance ? nextInMsFor(state) : undefined,
        steal: true,
        ...(stealTeam
          ? { stealTeam: { teamId: stealTeam.id, name: stealTeam.name, color: stealTeam.color } }
          : {}),
      });
      await release();
      if (state.settings.autoAdvance) {
        setTimeout(
          () =>
            void (async () => {
              const cur = await getRoom(gameId);
              if (cur?.status === GameStatus.ACTIVE) await startStealRound(gameId, stealTeamId);
            })().catch((err) => onRoundFailure(gameId, err, 'steal advance failed')),
          nextInMsFor(state),
        );
      }
      return;
    }

    // Win condition? Route through concludeGame so a tie opens sudden-death
    // overtime instead of crowning someone by join order.
    const questionsExhausted = state.roundIndex + 1 >= state.questionOrder.length;
    const win = evaluateWinCondition(state, questionsExhausted);
    if (win.isOver) {
      // Final question: hold on the answer reveal (correct option + who got it) for
      // the normal between-round window BEFORE the results / champion screen takes
      // over. Previously the last question jumped straight from the reveal to the
      // standings and the right answer was never seen (client feedback 2026-07-22:
      // "المفروض تظهر الاجابة ثم بعدها تنتهي اللعبة").
      round.phase = RoundPhase.INTERMISSION;
      await saveRoom(state);
      await release();
      // Show the final answer for the same 5s as the between-round recap before the
      // results screen takes over (client feedback 2026-07-22).
      const holdMs = 5000;
      setTimeout(
        () => void concludeGame(gameId).catch((err) => logger.error({ err, gameId }, 'final conclude failed')),
        holdMs,
      );
      return;
    }

    // ELIMINATION keeps playing to the last survivor — top up the order now so the
    // "next up" preview below points at a real question (no decisive tiebreak).
    await ensureEliminationQuestion(state);

    // Intermission → next round.
    round.phase = RoundPhase.INTERMISSION;
    await saveRoom(state);
    const nextInMs = state.settings.intermissionSec * 1000;
    // Preview the upcoming question's number + category so phones can show
    // "next: question X of Y" between rounds.
    const nextIdx = round.index + 1;
    let nextCategory: { nameAr: string; nameEn?: string; color: string; icon?: string } | undefined;
    if (nextIdx < state.questionOrder.length) {
      try {
        nextCategory = (await loadQuestion(state.questionOrder[nextIdx]!)).publicQuestion.category;
      } catch {
        nextCategory = undefined;
      }
    }
    emitter.toRoom(gameId, ServerEvent.ROUND_COMPLETED, {
      roundIndex: round.index + 1,
      nextInMs: state.settings.autoAdvance ? nextInMs : undefined,
      nextRound: nextIdx < state.questionOrder.length ? nextIdx + 1 : undefined,
      nextCategory,
      // ELIMINATION: everyone left was on their last life and everyone missed, so
      // the question is replayed with no life taken. Said out loud, otherwise the
      // unchanged hearts read as a scoring bug.
      ...(stalemate === 'replay' ? { stalemate: true } : {}),
    });

    await release();

    if (state.settings.autoAdvance) {
      setTimeout(
        () =>
          void (async () => {
            // Don't fire a new question if the game was paused during intermission
            // (e.g. host dropped). resumeGame() continues from here on reconnect.
            const cur = await getRoom(gameId);
            if (cur?.status === GameStatus.ACTIVE) await startNextRound(gameId);
          })().catch((err) => onRoundFailure(gameId, err, 'auto-advance failed')),
        nextInMs,
      );
    }
  } catch (err) {
    await release();
    throw err;
  }
}

// ─────────────────────────────── Sudden death ────────────────────────────────

/**
 * The scripted rounds are done. If the top is a tie, we do NOT crown anyone by
 * join order — we open sudden-death overtime among the tied contenders and play
 * decisive questions until exactly one wins (a single player, or a single team).
 */
async function concludeGame(gameId: string): Promise<void> {
  const state = await mustGetRoom(gameId);

  // ELIMINATION is decided purely by survival — the round loop already ran until a
  // single player held lives, so there is no tiebreak / decisive question. Crown
  // the last survivor (survival ranking handles the rare all-out-at-once edge).
  if (state.mode === GameMode.ELIMINATION && state.type === GameType.INDIVIDUAL) {
    const winner = [...Object.values(state.participants)].sort(compareSurvival)[0];
    await finishWithWinner(gameId, winner?.id, undefined);
    return;
  }

  const c = topContenders(state);
  if (c.unique) {
    await finishWithWinner(gameId, c.winnerId, c.winnerTeamId);
    return;
  }
  state.tiebreak = { contenders: c.contenders, isTeam: c.isTeam };
  await saveRoom(state);
  await scheduleTiebreak(gameId);
}

/** Announce the tie, then auto-advance into the next decisive question. */
async function scheduleTiebreak(gameId: string): Promise<void> {
  const state = await mustGetRoom(gameId);
  const nextInMs = state.settings.intermissionSec * 1000;
  emitter.toRoom(gameId, ServerEvent.ROUND_COMPLETED, {
    roundIndex: state.roundIndex + 1,
    nextInMs: state.settings.autoAdvance ? nextInMs : undefined,
    tiebreak: true,
  });
  if (!state.settings.autoAdvance) return; // host advances manually → startNextRound
  setTimeout(
    () =>
      void (async () => {
        const cur = await getRoom(gameId);
        if (cur?.status === GameStatus.ACTIVE) await startTiebreakRound(gameId);
      })().catch((err) => onRoundFailure(gameId, err, 'tiebreak advance failed')),
    nextInMs,
  );
}

/** A FREE game — in ANY format (individual points, individual elimination or
 *  teams) — is walled off from the paid bank: it may only ever serve questions
 *  from the fixed free-15 pack, replaying them in a fresh random order once the
 *  15 are spent (client 2026-07-28 «خلها تنعاد الأسئلة المجانية عليه عشان يضطر
 *  يشتري ألعاب», widened to teams 2026-08-28). Paid games draw from the whole
 *  bank as before. */
function isFreeTier(state: RoomState): boolean {
  return state.settings.tier === GameTier.FREE && state.mode !== GameMode.SEEN_JEEM;
}

/** A package question not yet used (scripted or prior tiebreak); reuse one only
 *  when the package is fully spent. */
async function pickTiebreakQuestion(state: RoomState): Promise<string> {
  const used = new Set([...state.questionOrder, ...(state.usedTiebreakIds ?? [])]);
  // FREE stays inside its own pack (recycling it); paid games prefer a FRESH
  // question from anywhere in the bank and only recycle the package as an
  // absolute last resort (every approved question already used — practically never).
  if (isFreeTier(state)) return pickPackageQuestion(state, used);
  return (await pickAnyUnusedQuestion(used)) ?? pickPackageQuestion(state, used);
}

/** Pick a package question not in `used`; once the bank is fully spent, fall back
 *  to any package question (recycling) so the round loop never runs dry. */
async function pickPackageQuestion(state: RoomState, used: Set<string>): Promise<string> {
  const pkgQs = await prisma.packageQuestion.findMany({
    where: { packageId: state.packageId },
    orderBy: { order: 'asc' },
    select: { questionId: true },
  });
  const ids = pkgQs.map((q) => q.questionId);
  const fresh = ids.filter((id) => !used.has(id));
  // Once every question has been shown, replay the pack in a random order — but
  // never hand back the question that was just asked, which would read as a bug.
  const justAsked = state.questionOrder[state.questionOrder.length - 1];
  const recycled = ids.length > 1 ? ids.filter((id) => id !== justAsked) : ids;
  const pool = fresh.length ? fresh : recycled;
  return pool[Math.floor(Math.random() * pool.length)] ?? state.questionOrder[state.questionOrder.length - 1]!;
}

/**
 * ELIMINATION runs to the last survivor, not to a fixed question count. If the
 * scripted order is about to run dry while 2+ players are still alive, append
 * another question (an unused one; recycle only once the source is spent) so the
 * duel always has a next question — no sudden-death "decisive question".
 *
 * The appended question prefers the game's configured category so the topic stays
 * on-theme:
 *   - per-player-category → continue the round-robin among the SURVIVORS, drawing
 *     from each one's own category (an eliminated player's category stops coming up);
 *   - single category      → keep drawing from that category.
 * Once the category has no UNUSED questions left it widens to a fresh question from
 * anywhere in the bank rather than repeat one — a question never repeats within a
 * game. No-op for other modes, and once a single survivor remains.
 */
async function ensureEliminationQuestion(state: RoomState): Promise<void> {
  if (state.mode !== GameMode.ELIMINATION || state.type !== GameType.INDIVIDUAL) return;
  if (state.roundIndex + 1 < state.questionOrder.length) return; // a scripted Q is still queued
  const active = activeParticipants(state);
  if (active.length <= 1) return; // game is about to end on its own

  const used = new Set([...state.questionOrder, ...(state.usedTiebreakIds ?? [])]);
  const nextIndex = state.questionOrder.length;
  let nextId: string | null = null;
  let ownerId: string | undefined;

  // FREE tier: never widen into the paid bank — replay the free-15 pack instead,
  // so a free elimination duel past question 15 keeps recycling the same set.
  if (isFreeTier(state)) {
    state.questionOrder.push(await pickPackageQuestion(state, used));
    return;
  }

  if (state.settings.perPlayerCategory) {
    // Rotate through the survivors (join order) and draw from the owner's category.
    const survivors = active.sort((a, b) => a.joinOrder - b.joinOrder);
    const owner = survivors[nextIndex % survivors.length]!;
    ownerId = owner.id;
    if (owner.categoryId) nextId = await pickCategoryQuestion(owner.categoryId, used);
  } else if (state.settings.categoryId) {
    nextId = await pickCategoryQuestion(state.settings.categoryId, used);
  }

  // The chosen category ran out of UNUSED questions → widen to a fresh question from
  // anywhere in the bank rather than repeat one. Recycle the package only as an
  // absolute last resort (the whole bank is used this game — never in practice).
  if (!nextId) nextId = await pickAnyUnusedQuestion(used);
  if (!nextId) nextId = await pickPackageQuestion(state, used);

  state.questionOrder.push(nextId);
  // Keep roundOwners aligned with questionOrder in per-player mode.
  if (state.settings.perPlayerCategory && ownerId) (state.roundOwners ??= []).push(ownerId);
}

/** Fire one sudden-death question (decided in resolveTiebreakRound). */
async function startTiebreakRound(gameId: string): Promise<void> {
  const state = await mustGetRoom(gameId);
  if (!state.tiebreak) return;
  const questionId = await pickTiebreakQuestion(state);
  const loaded = await loadQuestion(questionId);

  const now = Date.now();
  const startedAt = now + GET_READY_MS;
  const timeLimitSec = loaded.timeLimitSec || state.settings.questionTimerSec;
  const endsAt = startedAt + timeLimitSec * 1000;
  const roundId = nanoid(16);
  const nextIndex = state.roundIndex + 1;

  await prisma.round.create({
    data: {
      id: roundId,
      gameId,
      index: nextIndex,
      questionId,
      startedAt: new Date(startedAt),
      correctOptionId: loaded.correctOptionId,
    },
  });

  state.roundIndex = nextIndex;
  state.lastHeroes = undefined;
  (state.usedTiebreakIds ??= []).push(questionId);
  state.currentRound = {
    roundId,
    index: nextIndex,
    questionId,
    correctOptionId: loaded.correctOptionId,
    question: loaded.publicQuestion,
    startedAt,
    endsAt,
    phase: RoundPhase.COLLECTING,
    timeLimitSec,
    basePoints: loaded.basePoints,
    speedBonus: loaded.speedBonus,
    answers: {},
    isTiebreak: true,
  };
  await saveRoom(state);

  emitter.toRoom(gameId, ServerEvent.QUESTION_SHOW, {
    round: nextIndex + 1,
    roundId,
    question: loaded.publicQuestion,
    startsAt: startedAt,
    endsAt,
    tiebreak: true,
  });

  scheduleTicks(gameId, endsAt, (remainingMs) =>
    emitter.toRoom(gameId, ServerEvent.TIMER_TICK, { roundId, remainingMs }),
  );
  scheduleRoundEnd(gameId, endsAt, () =>
    void resolveRound(gameId).catch((err) => onRoundFailure(gameId, err, 'tiebreak resolve failed')),
  );
}

/** Reveal + decide a sudden-death round. Caller holds the room lock. */
async function resolveTiebreakRound(gameId: string, state: RoomState, round: LiveRound): Promise<void> {
  round.phase = RoundPhase.RESOLVING;

  const distribution: Record<string, number> = {};
  for (const ans of Object.values(round.answers)) {
    distribution[ans.optionId] = (distribution[ans.optionId] ?? 0) + 1;
  }
  // The contender participant ids (expand team contenders to their members).
  const contenderPids = new Set(
    state.tiebreak?.isTeam
      ? Object.values(state.participants)
          .filter((p) => p.teamId && state.tiebreak!.contenders.includes(p.teamId))
          .map((p) => p.id)
      : state.tiebreak?.contenders ?? [],
  );
  const topAnswerers = Object.entries(round.answers)
    .filter(([pid, ans]) => contenderPids.has(pid) && ans.optionId === round.correctOptionId)
    .map(([pid, ans]) => ({ pid, ms: ans.serverTs - round.startedAt }))
    .sort((a, b) => a.ms - b.ms)
    .map((x, i) => {
      const p = state.participants[x.pid]!;
      return { participantId: x.pid, nickname: p.nickname, avatarId: p.avatarId, place: i + 1 };
    });

  const loaded = await loadQuestion(round.questionId).catch(() => null);
  emitter.toRoom(gameId, ServerEvent.QUESTION_REVEAL, {
    roundId: round.roundId,
    correctOptionId: round.correctOptionId,
    distribution,
    topAnswerers,
    explanationAr: loaded?.explanationAr,
    explanationEn: loaded?.explanationEn,
  });

  for (const pid of contenderPids) {
    const p = state.participants[pid];
    const ans = round.answers[pid];
    if (p?.socketId) {
      emitter.toSocket(p.socketId, ServerEvent.ANSWER_RESULT, {
        roundId: round.roundId,
        isCorrect: !!ans && ans.optionId === round.correctOptionId,
        pointsAwarded: 0,
        newScore: p.score,
        livesLeft: p.lives,
      });
    }
  }

  const decision = decideTiebreak(state, round);
  if (decision.decided) {
    // Award the decisive point so the FINAL score reflects the overtime win
    // (otherwise the board still shows the pre-tie-break tie, e.g. 3–3).
    if (decision.winnerId && state.participants[decision.winnerId]) {
      state.participants[decision.winnerId]!.score += 1;
    } else if (decision.winnerTeamId && state.teams[decision.winnerTeamId]) {
      state.teams[decision.winnerTeamId]!.score += 1;
    }
    state.tiebreak = undefined;
    // Push the updated score to the room so the leaderboard reflects it before the
    // game-over screen.
    emitter.toRoom(gameId, ServerEvent.SCORE_UPDATE, {
      leaderboard: buildLeaderboard(state),
      ...(state.type === GameType.TEAMS ? { teams: publicTeams(state) } : {}),
    });
    await saveRoom(state);
    await finishWithWinner(gameId, decision.winnerId, decision.winnerTeamId);
    return;
  }

  // Still tied → narrow to those still level and play another decisive question.
  state.tiebreak = { contenders: decision.contenders, isTeam: decision.isTeam };
  round.phase = RoundPhase.INTERMISSION;
  await saveRoom(state);
  await scheduleTiebreak(gameId);
}

// ──────────────────────────────── Complete ──────────────────────────────────

async function finishWithWinner(gameId: string, winnerId?: string, winnerTeamId?: string): Promise<void> {
  const state = await getRoom(gameId);
  if (!state) return;
  if (winnerId && state.participants[winnerId]) {
    state.participants[winnerId]!.status = ParticipantStatus.WINNER;
  }
  state.status = GameStatus.COMPLETED;
  await saveRoom(state);
  await completeGame(gameId, true, winnerId, winnerTeamId);
}

export async function completeGame(
  gameId: string,
  _exhausted: boolean,
  winnerId?: string,
  winnerTeamId?: string,
): Promise<void> {
  clearRoundTimer(gameId);
  clearTicks(gameId);
  const state = await getRoom(gameId);
  if (!state) return;

  state.status = GameStatus.COMPLETED;
  const durationSec = Math.round((Date.now() - (state.startedAt ?? Date.now())) / 1000);
  let leaderboard = buildLeaderboard(state);

  // Pick winner if not provided (force-end path).
  if (!winnerId && !winnerTeamId) {
    const top = leaderboard[0];
    if (top) {
      winnerId = top.participantId;
      const w = state.participants[winnerId];
      if (w) w.status = ParticipantStatus.WINNER;
    }
  }

  // The declared champion ALWAYS sits at rank 1, even when a sudden-death winner
  // isn't the top scorer (both ended on the same points). Otherwise the ranking
  // would label the score-leader "البطل" while the champion screen shows someone
  // else — two different champions on screen.
  if (winnerId || winnerTeamId) {
    const isWinner = (e: (typeof leaderboard)[number]) =>
      (winnerId && e.participantId === winnerId) || (winnerTeamId && e.teamId === winnerTeamId);
    leaderboard = [...leaderboard]
      .sort((a, b) => Number(isWinner(b)) - Number(isWinner(a)))
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }

  // Flush final participant state + result.
  await prisma.$transaction([
    ...Object.values(state.participants).map((p) =>
      prisma.participant.update({
        where: { id: p.id },
        data: { score: p.score, lives: p.lives, status: p.status, eliminatedRound: p.eliminatedRound ?? null },
      }),
    ),
    prisma.game.update({ where: { id: gameId }, data: { status: GameStatus.COMPLETED, endedAt: new Date() } }),
    prisma.gameResult.create({
      data: {
        gameId,
        winnerParticipantId: winnerId ?? null,
        winnerTeamId: winnerTeamId ?? null,
        totalPlayers: Object.keys(state.participants).length,
        totalRounds: state.roundIndex + 1,
        durationSec,
        leaderboard: leaderboard as never,
      },
    }),
    ...profileStatUpdates(state, winnerId, winnerTeamId),
  ]);
  await saveRoom(state);

  const winner = winnerId ? state.participants[winnerId] : undefined;
  const isTeams = Object.keys(state.teams).length > 0;
  // Authoritative final team table (scores + members) so the result screen never
  // falls back to stale/zeroed team data.
  const teams = isTeams ? publicTeams(state) : undefined;
  const winnerTeam = winnerTeamId
    ? teams?.find((t) => t.id === winnerTeamId) ?? null
    : null;
  const payload: GameCompletedPayload = {
    winner: winner ? toPublicParticipant(winner) : null,
    winnerTeam,
    teams,
    finalLeaderboard: leaderboard,
    stats: { totalRounds: state.roundIndex + 1, durationSec, totalPlayers: Object.keys(state.participants).length },
  };
  emitter.toRoom(gameId, ServerEvent.GAME_COMPLETED, payload);
}

// ──────────────────────────── Host controls ─────────────────────────────────

export async function pauseGame(gameId: string): Promise<void> {
  const state = await mustGetRoom(gameId);
  if (state.status !== GameStatus.ACTIVE) return;
  fsm.assertTransition(state.status, GameStatus.PAUSED);
  state.status = GameStatus.PAUSED;
  if (state.currentRound && state.currentRound.phase === RoundPhase.COLLECTING) {
    state.pausedRemainingMs = Math.max(0, state.currentRound.endsAt - Date.now());
    clearRoundTimer(gameId);
    clearTicks(gameId);
  }
  await saveRoom(state);
  emitter.toRoom(gameId, ServerEvent.GAME_PAUSED, { reason: 'host' });
}

export async function resumeGame(gameId: string): Promise<void> {
  const state = await mustGetRoom(gameId);
  if (state.status !== GameStatus.PAUSED) return;
  state.status = GameStatus.ACTIVE;
  if (state.currentRound && state.currentRound.phase === RoundPhase.COLLECTING && state.pausedRemainingMs != null) {
    const endsAt = Date.now() + state.pausedRemainingMs;
    state.currentRound.endsAt = endsAt;
    state.pausedRemainingMs = undefined;
    await saveRoom(state);
    scheduleTicks(gameId, endsAt, (remainingMs) =>
      emitter.toRoom(gameId, ServerEvent.TIMER_TICK, { roundId: state.currentRound!.roundId, remainingMs }),
    );
    scheduleRoundEnd(gameId, endsAt, () => void resolveRound(gameId));
  } else if (state.currentRound && state.currentRound.phase === RoundPhase.INTERMISSION && state.settings.autoAdvance) {
    // Paused mid-intermission (the auto-advance was skipped). Resume the loop —
    // replaying a queued steal first, so pausing during the recap can't rob the
    // other team of its attempt at the missed question.
    const steal = state.pendingSteal;
    await saveRoom(state);
    emitter.toRoom(gameId, ServerEvent.GAME_RESUMED, { reason: 'host' });
    if (steal) await startStealRound(gameId, steal);
    else await startNextRound(gameId);
    return;
  } else {
    await saveRoom(state);
  }
  emitter.toRoom(gameId, ServerEvent.GAME_RESUMED, { reason: 'host' });
}

export async function kickPlayer(gameId: string, participantId: string): Promise<void> {
  await leave(gameId, participantId);
}

export async function endGame(gameId: string): Promise<void> {
  await completeGame(gameId, false);
}

/**
 * Hand the host their game-credit back when a PAID game was charged for but can
 * never be finished — the room was abandoned mid-match, or the engine had to
 * abort it (client 2026-08-30: «إعادة رصيد اللعبة تلقائيًا إذا تعذر إكمالها بسبب
 * خطأ تقني»). A COMPLETED game was played and is never refunded.
 *
 * Idempotent: the refund is claimed by clearing `creditChargedAt` in a
 * conditional update, so two abandon paths racing can only ever return one credit
 * — and a later start of the same room would legitimately charge again.
 */
async function refundCreditIfUnfinished(gameId: string): Promise<boolean> {
  const row = await prisma.game
    .findUnique({ where: { id: gameId }, select: { status: true, creditChargedAt: true, hostPlayerId: true } })
    .catch(() => null);
  if (!row?.creditChargedAt || !row.hostPlayerId) return false;
  if (row.status === GameStatus.COMPLETED) return false;

  const claimed = await prisma.game.updateMany({
    where: { id: gameId, creditChargedAt: { not: null } },
    data: { creditChargedAt: null },
  });
  if (claimed.count === 0) return false; // another path already refunded it

  await refundCredit(row.hostPlayerId);
  logger.warn({ gameId, hostPlayerId: row.hostPlayerId }, 'refunded game credit for an unfinished game');
  return true;
}

export async function abandonRoom(gameId: string): Promise<void> {
  clearRoundTimer(gameId);
  clearTicks(gameId);
  const state = await getRoom(gameId);
  if (state) {
    // A paid game that never reached its end shouldn't cost the host anything.
    await refundCreditIfUnfinished(gameId).catch((err) =>
      logger.error({ err, gameId }, 'credit refund on abandon failed'),
    );
    await prisma.game.update({ where: { id: gameId }, data: { status: GameStatus.ABANDONED, endedAt: new Date() } }).catch(() => {});
    await deleteRoom(state);
  }
}

/**
 * Abort a live game the engine can no longer run (a technical fault). Ends it for
 * everyone, refunds the host's credit and tears the room down — nothing is left
 * hanging for a host who already paid.
 */
export async function abortGame(gameId: string, reason: string): Promise<void> {
  logger.error({ gameId, reason }, 'aborting game');
  const state = await getRoom(gameId);
  if (state) {
    emitter.toRoom(gameId, ServerEvent.GAME_PAUSED, { reason: 'error' });
  }
  await abandonRoom(gameId);
}

export function snapshotFor(state: RoomState, selfId?: string) {
  return buildSnapshot(state, selfId);
}

// ─────────────────────────────── helpers ────────────────────────────────────

async function mustGetRoom(gameId: string): Promise<RoomState> {
  const state = await getRoom(gameId);
  if (!state) throw new AppError(ErrorCode.UNKNOWN_ROOM, 'Room not found or expired');
  return state;
}
