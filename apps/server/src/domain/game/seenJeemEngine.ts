/**
 * Seen-Jeem orchestrator — the I/O shell around the pure core (`seenjeem.ts`).
 *
 * It owns the turn-based board loop: draft → select → answer → resolve, with three
 * one-shot lifelines. It supplies content (categories/questions), schedules the
 * answer-window timer, persists milestones (lifeline spends, final result) and
 * emits via the shared GameEmitter — but never reimplements a rule that lives in
 * the pure core. Every mutation runs under the same per-room lock the elimination
 * engine uses, so the two formats can't race on one room.
 */
import {
  AppError,
  ErrorCode,
  GameStatus,
  GameMode,
  ParticipantStatus,
  ServerEvent,
  SeenJeemPhase,
  Lifeline,
  SEEN_JEEM,
  DIFFICULTY_POINTS,
  type Difficulty,
  type GameCompletedPayload,
} from '@tahaddi/shared';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { getRoom, saveRoom } from '../rooms/roomStore.js';
import type { RoomState, SJCategory, SJCell } from '../rooms/types.js';
import { loadQuestion } from '../content/questionLoader.js';
import { buildSeenJeemSnapshot, buildLeaderboard, buildSnapshot } from './snapshot.js';
import { getEmitter } from './emitterRef.js';
import { withRoomLock, acquireRoomLock } from './lock.js';
import {
  scheduleRoundEnd,
  clearRoundTimer,
  scheduleTicks,
  clearTicks,
} from './timer.js';
import {
  initSeenJeem,
  pickCategory,
  buildBoard,
  buildCategoryCells,
  selectCell,
  useLifeline,
  recordAnswer,
  assertAnswerable,
  resolveCell,
  evaluateWinner,
} from './seenjeem.js';

const TEAM_PALETTE = ['#7C3AED', '#22D3EE'];
const TEAM_NAMES = ['الفريق الأول', 'الفريق الثاني'];

const cellIdFor = (categoryId: string, points: number, slot: number) =>
  `${categoryId}:${points}:${slot}`;

function mustSj(state: RoomState) {
  if (!state.seenJeem) throw new AppError(ErrorCode.INVALID_STATE, 'Not a Seen-Jeem game');
  return state.seenJeem;
}

function teamScores(state: RoomState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of mustSj(state).teamIds) out[id] = state.teams[id]?.score ?? 0;
  return out;
}

function emitState(state: RoomState): void {
  getEmitter().toRoom(state.gameId, ServerEvent.SJ_STATE, buildSeenJeemSnapshot(mustSj(state)));
}

// ─────────────────────────────── Start / draft ──────────────────────────────

/** Load 6 distinct board categories (with metadata) from the package content. */
async function loadBoardCategories(packageId: string): Promise<SJCategory[]> {
  const rows = await prisma.packageQuestion.findMany({
    where: { packageId },
    select: {
      question: {
        select: {
          categoryId: true,
          category: { select: { nameAr: true, nameEn: true, color: true, icon: true } },
        },
      },
    },
  });
  const byId = new Map<string, SJCategory>();
  for (const r of rows) {
    const q = r.question;
    if (!q?.category || byId.has(q.categoryId)) continue;
    byId.set(q.categoryId, {
      categoryId: q.categoryId,
      nameAr: q.category.nameAr,
      nameEn: q.category.nameEn ?? undefined,
      color: q.category.color,
      icon: q.category.icon ?? undefined,
    });
  }
  const cats = [...byId.values()];
  if (cats.length < SEEN_JEEM.CATEGORIES_ON_BOARD) {
    throw new AppError(
      ErrorCode.CONFLICT,
      `Seen-Jeem needs ${SEEN_JEEM.CATEGORIES_ON_BOARD} categories; package has ${cats.length}`,
    );
  }
  return cats.slice(0, SEEN_JEEM.CATEGORIES_ON_BOARD);
}

/** Set up two teams, draft the board of 6 categories, and open the DRAFT phase. */
export async function startSeenJeem(gameId: string): Promise<void> {
  const state = await getRoom(gameId);
  if (!state) throw new AppError(ErrorCode.UNKNOWN_ROOM, 'Room not found');

  const players = Object.values(state.participants)
    .filter((p) => p.status === ParticipantStatus.ACTIVE)
    .sort((a, b) => a.joinOrder - b.joinOrder);
  if (players.length < SEEN_JEEM.TEAMS) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Seen-Jeem needs at least two players');
  }

  // Exactly two teams; players split round-robin by join order.
  const teamIds: string[] = [];
  for (let i = 0; i < SEEN_JEEM.TEAMS; i++) {
    const team = await prisma.team.create({
      data: { gameId, name: TEAM_NAMES[i]!, color: TEAM_PALETTE[i]! },
    });
    state.teams[team.id] = { id: team.id, name: team.name, color: team.color, score: 0 };
    teamIds.push(team.id);
  }
  players.forEach((p, idx) => {
    p.teamId = teamIds[idx % SEEN_JEEM.TEAMS];
  });
  await prisma.$transaction(
    players.map((p) => prisma.participant.update({ where: { id: p.id }, data: { teamId: p.teamId } })),
  );

  const categories = await loadBoardCategories(state.packageId);
  const first =
    state.settings.firstTeamId && state.teams[state.settings.firstTeamId]
      ? state.settings.firstTeamId
      : teamIds[0]!;

  state.seenJeem = initSeenJeem([teamIds[0]!, teamIds[1]!], categories, first);
  state.status = GameStatus.ACTIVE;
  state.startedAt = Date.now();
  await prisma.game.update({ where: { id: gameId }, data: { status: GameStatus.ACTIVE, startedAt: new Date() } });
  await saveRoom(state);

  getEmitter().toRoom(gameId, ServerEvent.GAME_STARTED, {
    totalRounds: SEEN_JEEM.CATEGORIES_PER_TEAM * SEEN_JEEM.CELLS_PER_CATEGORY * SEEN_JEEM.TEAMS,
    mode: GameMode.SEEN_JEEM,
    settings: state.settings,
  });
  // Full snapshot first (carries team identities + participant→team), then the
  // Seen-Jeem projection drives the board UI from here on.
  getEmitter().toRoom(gameId, ServerEvent.ROOM_STATE, buildSnapshot(state));
  emitState(state);
}

/** Build the 36-cell board once both teams have drafted their 3 categories. */
async function installBoard(state: RoomState): Promise<void> {
  const sj = mustSj(state);
  const cells: SJCell[] = [];
  for (const cat of sj.categories) {
    const rows = await prisma.packageQuestion.findMany({
      where: { packageId: state.packageId, question: { categoryId: cat.categoryId } },
      select: { question: { select: { id: true, correctOptionId: true, difficulty: true } } },
    });
    const pool = rows
      .map((r) => r.question!)
      .sort((a, b) => DIFFICULTY_POINTS[a.difficulty as Difficulty] - DIFFICULTY_POINTS[b.difficulty as Difficulty])
      .map((q) => ({ questionId: q.id, correctOptionId: q.correctOptionId }));
    cells.push(...buildCategoryCells(cat.categoryId, pool, cellIdFor));
  }
  buildBoard(sj, cells);
}

export async function draftPick(gameId: string, teamId: string, categoryId: string): Promise<void> {
  const state = await withRoomLock(gameId, async () => {
    const state = await getRoom(gameId);
    if (!state) throw new AppError(ErrorCode.UNKNOWN_ROOM, 'Room not found');
    const sj = mustSj(state);
    const { complete } = pickCategory(sj, teamId, categoryId);
    if (complete) await installBoard(state);
    await saveRoom(state);
    return state;
  });
  emitState(state);
  const sj = mustSj(state);
  if (sj.phase === SeenJeemPhase.SELECT) {
    getEmitter().toRoom(gameId, ServerEvent.SJ_TURN_CHANGED, { turnTeamId: sj.turnTeamId, phase: sj.phase });
  }
}

// ──────────────────────────────── Cell selection ────────────────────────────

export async function cellSelect(gameId: string, teamId: string, cellId: string): Promise<void> {
  const now = Date.now();
  const endsAt = now + SEEN_JEEM.ANSWER_TIMER_SEC * 1000;
  const { state, payload } = await withRoomLock(gameId, async () => {
    const state = await getRoom(gameId);
    if (!state) throw new AppError(ErrorCode.UNKNOWN_ROOM, 'Room not found');
    const sj = mustSj(state);
    const cell = selectCell(sj, teamId, cellId, now, endsAt);
    const loaded = await loadQuestion(cell.questionId);
    sj.active!.question = loaded.publicQuestion;
    await saveRoom(state);
    return {
      state,
      payload: {
        cellId,
        categoryId: cell.categoryId,
        points: cell.points,
        answeringTeamId: teamId,
        question: loaded.publicQuestion,
        endsAt,
      },
    };
  });

  getEmitter().toRoom(gameId, ServerEvent.SJ_CELL_OPENED, payload);
  emitState(state);

  scheduleTicks(gameId, endsAt, (remainingMs) =>
    getEmitter().toRoom(gameId, ServerEvent.TIMER_TICK, { roundId: cellId, remainingMs }),
  );
  scheduleRoundEnd(gameId, endsAt, () =>
    void resolveActive(gameId, { kind: 'timeout', cellId }).catch((err) =>
      logger.error({ err, gameId }, 'seen-jeem timeout resolve failed'),
    ),
  );
}

// ─────────────────────────────────── Lifelines ──────────────────────────────

export async function lifelineUse(gameId: string, teamId: string, lifeline: Lifeline): Promise<void> {
  const { state, rescheduleTo, payload } = await withRoomLock(gameId, async () => {
    const state = await getRoom(gameId);
    if (!state) throw new AppError(ErrorCode.UNKNOWN_ROOM, 'Room not found');
    const sj = mustSj(state);
    const active = sj.active;
    if (!active) throw new AppError(ErrorCode.INVALID_STATE, 'No open question');
    const cell = sj.board.find((c) => c.cellId === active.cellId);
    const optionIds = active.question?.options.map((o) => o.id) ?? [];

    const eff = useLifeline(sj, teamId, lifeline, {
      optionIds,
      correctOptionId: cell?.correctOptionId,
    });
    await saveRoom(state);

    // Durable audit (unique on game+team+lifeline; ignore a duplicate).
    await prisma.lifelineUsage
      .create({ data: { gameId, teamId, lifeline, cellId: active.cellId } })
      .catch(() => undefined);

    const payload: Record<string, unknown> = { teamId, lifeline };
    let rescheduleTo: number | undefined;
    if (eff.lifeline === Lifeline.CALL_FRIEND) {
      payload.endsAt = eff.endsAt;
      rescheduleTo = eff.endsAt;
    } else if (eff.lifeline === Lifeline.DISCARD) {
      payload.removedOptionIds = eff.removedOptionIds;
    } else {
      payload.doubled = true;
    }
    return { state, rescheduleTo, payload };
  });

  getEmitter().toRoom(gameId, ServerEvent.SJ_LIFELINE_USED, payload);
  emitState(state);

  // CALL_FRIEND extended the window — reschedule the timer + ticks.
  if (rescheduleTo) {
    clearRoundTimer(gameId);
    clearTicks(gameId);
    scheduleTicks(gameId, rescheduleTo, (remainingMs) =>
      getEmitter().toRoom(gameId, ServerEvent.TIMER_TICK, {
        roundId: mustSj(state).active?.cellId ?? '',
        remainingMs,
      }),
    );
    scheduleRoundEnd(gameId, rescheduleTo, () =>
      void resolveActive(gameId, { kind: 'timeout' }).catch((err) =>
        logger.error({ err, gameId }, 'seen-jeem timeout resolve failed'),
      ),
    );
  }
}

// ──────────────────────────────── Answer / resolve ──────────────────────────

export async function teamAnswer(
  gameId: string,
  teamId: string,
  cellId: string,
  optionId: string,
): Promise<void> {
  await resolveActive(gameId, { kind: 'team', teamId, cellId, optionId });
}

/** Host arbitration for spoken/open answers (accept or reject). */
export async function adjudicate(gameId: string, cellId: string, correct: boolean): Promise<void> {
  await resolveActive(gameId, { kind: 'host', cellId, correct });
}

type ResolveOpts =
  | { kind: 'team'; teamId: string; cellId: string; optionId: string }
  | { kind: 'host'; cellId: string; correct: boolean }
  | { kind: 'timeout'; cellId?: string };

/**
 * Settle the open cell exactly once (timer-fire and a manual answer can collide).
 * Decides correctness per the trigger, runs the pure resolver, persists, emits,
 * and either advances the turn or finishes the game.
 */
async function resolveActive(gameId: string, opts: ResolveOpts): Promise<void> {
  const release = await acquireRoomLock(gameId);
  if (!release) return;
  try {
    const state = await getRoom(gameId);
    if (!state?.seenJeem?.active) return;
    const sj = state.seenJeem;
    const active = sj.active!;
    if (opts.cellId && opts.cellId !== active.cellId) return; // stale trigger

    const cell = sj.board.find((c) => c.cellId === active.cellId);
    if (!cell) return;

    let isCorrect: boolean;
    if (opts.kind === 'team') {
      assertAnswerable(sj, opts.teamId, active.cellId, Date.now());
      recordAnswer(sj, opts.optionId);
      isCorrect = opts.optionId === cell.correctOptionId;
    } else if (opts.kind === 'host') {
      isCorrect = opts.correct;
    } else {
      isCorrect = false; // timed out → wrong
    }

    clearRoundTimer(gameId);
    clearTicks(gameId);

    const correctOptionId = cell.correctOptionId;
    const res = resolveCell(sj, state.teams, isCorrect);
    await saveRoom(state);

    const loaded = await loadQuestion(cell.questionId).catch(() => null);
    getEmitter().toRoom(gameId, ServerEvent.SJ_CELL_RESOLVED, {
      cellId: cell.cellId,
      correctOptionId,
      selectedOptionId: res.selectedOptionId,
      isCorrect: res.isCorrect,
      answeringTeamId: res.answeringTeamId,
      pointsAwarded: res.pointsAwarded,
      teamScores: teamScores(state),
      explanationAr: loaded?.explanationAr,
      explanationEn: loaded?.explanationEn,
    });
    emitState(state);

    if (res.complete) {
      await release();
      await finishSeenJeem(gameId);
      return;
    }
    getEmitter().toRoom(gameId, ServerEvent.SJ_TURN_CHANGED, {
      turnTeamId: sj.turnTeamId,
      phase: sj.phase,
    });
    await release();
  } catch (err) {
    await release();
    throw err;
  }
}

// ──────────────────────────────────── Finish ────────────────────────────────

async function finishSeenJeem(gameId: string): Promise<void> {
  clearRoundTimer(gameId);
  clearTicks(gameId);
  const state = await getRoom(gameId);
  if (!state?.seenJeem) return;
  const sj = state.seenJeem;

  const win = evaluateWinner(sj, state.teams);
  state.status = GameStatus.COMPLETED;

  // Mark winning team's members as WINNER.
  if (win.winnerTeamId) {
    for (const p of Object.values(state.participants)) {
      if (p.teamId === win.winnerTeamId) p.status = ParticipantStatus.WINNER;
    }
  }

  const durationSec = Math.round((Date.now() - (state.startedAt ?? Date.now())) / 1000);
  const leaderboard = buildLeaderboard(state);

  await prisma.$transaction([
    ...Object.values(state.participants).map((p) =>
      prisma.participant.update({
        where: { id: p.id },
        data: { score: p.score, status: p.status },
      }),
    ),
    prisma.game.update({ where: { id: gameId }, data: { status: GameStatus.COMPLETED, endedAt: new Date() } }),
    prisma.gameResult.create({
      data: {
        gameId,
        winnerTeamId: win.winnerTeamId ?? null,
        totalPlayers: Object.keys(state.participants).length,
        totalRounds: sj.board.length,
        durationSec,
        leaderboard: leaderboard as never,
      },
    }),
  ]);
  await saveRoom(state);

  const winnerTeam = win.winnerTeamId ? state.teams[win.winnerTeamId] : undefined;
  const payload: GameCompletedPayload = {
    winner: null,
    winnerTeam: winnerTeam
      ? {
          id: winnerTeam.id,
          name: winnerTeam.name,
          color: winnerTeam.color,
          score: winnerTeam.score,
          memberIds: Object.values(state.participants)
            .filter((p) => p.teamId === winnerTeam.id)
            .map((p) => p.id),
        }
      : null,
    finalLeaderboard: leaderboard,
    stats: {
      totalRounds: sj.board.length,
      durationSec,
      totalPlayers: Object.keys(state.participants).length,
    },
  };
  getEmitter().toRoom(gameId, ServerEvent.GAME_COMPLETED, payload);
}

// ─────────────────────────────────── helpers ────────────────────────────────

/** Resolve which team a participant plays for (members act on the team's behalf). */
export async function teamOf(gameId: string, participantId?: string): Promise<string> {
  if (!participantId) throw new AppError(ErrorCode.NOT_AUTHORIZED, 'Not joined');
  const state = await getRoom(gameId);
  const teamId = state?.participants[participantId]?.teamId;
  if (!teamId) throw new AppError(ErrorCode.INVALID_STATE, 'You are not on a team yet');
  return teamId;
}
