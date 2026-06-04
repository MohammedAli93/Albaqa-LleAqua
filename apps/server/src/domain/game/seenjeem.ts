/**
 * Seen-Jeem pure core — the turn-based board format's fairness logic.
 *
 * Like `scoring.ts`, this module is I/O-free and exhaustively unit-tested. It owns
 * the draft, the board, lifelines, turn order, point settlement and win condition.
 * The orchestrator (`seenJeemEngine.ts`) supplies content + timers and handles
 * Redis/Postgres/emits; it never reimplements a rule that lives here.
 *
 * Legal moves are guarded with AppError(INVALID_STATE) so an out-of-turn or
 * illegal intent is rejected, never allowed to corrupt the board.
 */
import {
  AppError,
  ErrorCode,
  SeenJeemPhase,
  Lifeline,
  SEEN_JEEM,
} from '@tahaddi/shared';
import type { LiveSeenJeem, SJCategory, SJCell } from '../rooms/types.js';

type ScoreMap = Record<string, { score: number }>;

// ───────────────────────────────── Init / draft ─────────────────────────────

/**
 * Create the initial Seen-Jeem state in DRAFT. `categories` must contain exactly
 * CATEGORIES_ON_BOARD entries (unowned). The draft order alternates A,B,A,B,A,B
 * starting from `firstTeamId`, so each team ends with CATEGORIES_PER_TEAM.
 */
export function initSeenJeem(
  teamIds: [string, string],
  categories: SJCategory[],
  firstTeamId: string,
): LiveSeenJeem {
  if (categories.length !== SEEN_JEEM.CATEGORIES_ON_BOARD) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `Seen-Jeem needs exactly ${SEEN_JEEM.CATEGORIES_ON_BOARD} categories`,
    );
  }
  if (!teamIds.includes(firstTeamId)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'firstTeamId not in teams');
  }
  const second = teamIds[0] === firstTeamId ? teamIds[1] : teamIds[0];
  const draftOrder: string[] = [];
  for (let i = 0; i < SEEN_JEEM.CATEGORIES_ON_BOARD; i++) {
    draftOrder.push(i % 2 === 0 ? firstTeamId : second);
  }
  const lifelines: LiveSeenJeem['lifelines'] = {};
  for (const t of teamIds) {
    lifelines[t] = {
      [Lifeline.CALL_FRIEND]: true,
      [Lifeline.DISCARD]: true,
      [Lifeline.DOUBLE]: true,
    };
  }
  return {
    phase: SeenJeemPhase.DRAFT,
    teamIds,
    categories: categories.map((c) => ({ ...c, ownerTeamId: undefined })),
    board: [],
    draftOrder,
    draftIndex: 0,
    turnTeamId: firstTeamId,
    lifelines,
  };
}

/** The team whose draft pick it is, or undefined if drafting is done. */
export function currentDraftTeam(sj: LiveSeenJeem): string | undefined {
  return sj.draftOrder[sj.draftIndex];
}

export function assertDraftPick(
  sj: LiveSeenJeem,
  teamId: string,
  categoryId: string,
): SJCategory {
  if (sj.phase !== SeenJeemPhase.DRAFT) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Not in the draft phase');
  }
  if (currentDraftTeam(sj) !== teamId) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Not your pick');
  }
  const cat = sj.categories.find((c) => c.categoryId === categoryId);
  if (!cat) throw new AppError(ErrorCode.VALIDATION_ERROR, 'Unknown category');
  if (cat.ownerTeamId) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Category already taken');
  }
  return cat;
}

/**
 * Claim a category for a team. Returns `{ complete }` — true once all
 * CATEGORIES_ON_BOARD are owned, at which point the caller must call buildBoard.
 */
export function pickCategory(
  sj: LiveSeenJeem,
  teamId: string,
  categoryId: string,
): { complete: boolean } {
  const cat = assertDraftPick(sj, teamId, categoryId);
  cat.ownerTeamId = teamId;
  sj.draftIndex += 1;
  const next = currentDraftTeam(sj);
  if (next) {
    sj.turnTeamId = next;
    return { complete: false };
  }
  return { complete: true };
}

/**
 * Install the drafted board. `cells` must cover exactly the owned categories
 * (the orchestrator builds them from package content). Moves the game to SELECT
 * with the first-drafting team on turn.
 */
export function buildBoard(sj: LiveSeenJeem, cells: SJCell[]): void {
  if (sj.phase !== SeenJeemPhase.DRAFT || currentDraftTeam(sj)) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Draft not complete');
  }
  sj.board = cells;
  sj.phase = SeenJeemPhase.SELECT;
  sj.turnTeamId = sj.teamIds[0];
}

// ──────────────────────────────── Cell selection ────────────────────────────

export function remainingForTeam(sj: LiveSeenJeem, teamId: string): SJCell[] {
  const owned = new Set(
    sj.categories.filter((c) => c.ownerTeamId === teamId).map((c) => c.categoryId),
  );
  return sj.board.filter((cell) => owned.has(cell.categoryId) && !cell.consumed);
}

export function remainingCells(sj: LiveSeenJeem): SJCell[] {
  return sj.board.filter((c) => !c.consumed);
}

export function assertCellSelect(
  sj: LiveSeenJeem,
  teamId: string,
  cellId: string,
): SJCell {
  if (sj.phase !== SeenJeemPhase.SELECT) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Not selecting a cell');
  }
  if (sj.turnTeamId !== teamId) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Not your turn');
  }
  const cell = sj.board.find((c) => c.cellId === cellId);
  if (!cell) throw new AppError(ErrorCode.VALIDATION_ERROR, 'Unknown cell');
  if (cell.consumed) throw new AppError(ErrorCode.INVALID_STATE, 'Cell already played');
  const owner = sj.categories.find((c) => c.categoryId === cell.categoryId)?.ownerTeamId;
  if (owner !== teamId) {
    throw new AppError(ErrorCode.INVALID_STATE, 'That cell is not on your board');
  }
  return cell;
}

/** Open a cell for the team on turn. The caller has computed the answer window. */
export function selectCell(
  sj: LiveSeenJeem,
  teamId: string,
  cellId: string,
  openedAt: number,
  endsAt: number,
): SJCell {
  const cell = assertCellSelect(sj, teamId, cellId);
  sj.active = {
    cellId,
    doubled: false,
    removedOptionIds: [],
    answeringTeamId: teamId,
    openedAt,
    endsAt,
  };
  sj.phase = SeenJeemPhase.ANSWERING;
  return cell;
}

// ─────────────────────────────────── Lifelines ──────────────────────────────

export type LifelineEffect =
  | { lifeline: typeof Lifeline.CALL_FRIEND; endsAt: number }
  | { lifeline: typeof Lifeline.DISCARD; removedOptionIds: string[] }
  | { lifeline: typeof Lifeline.DOUBLE; doubled: true };

export function assertLifeline(
  sj: LiveSeenJeem,
  teamId: string,
  lifeline: Lifeline,
): void {
  if (sj.phase !== SeenJeemPhase.ANSWERING || !sj.active) {
    throw new AppError(ErrorCode.INVALID_STATE, 'No open question');
  }
  if (sj.active.answeringTeamId !== teamId) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Not your question');
  }
  if (!sj.lifelines[teamId]?.[lifeline]) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Lifeline already used');
  }
}

/**
 * Spend a one-shot lifeline and apply its effect.
 *  - CALL_FRIEND extends the answer window by CALL_FRIEND_EXTRA_SEC.
 *  - DISCARD removes the first DISCARD_REMOVES wrong options (deterministic →
 *    testable; no RNG, which is also unavailable in this runtime).
 *  - DOUBLE marks the open cell's stake as doubled.
 */
export function useLifeline(
  sj: LiveSeenJeem,
  teamId: string,
  lifeline: Lifeline,
  ctx: { optionIds?: string[]; correctOptionId?: string },
): LifelineEffect {
  assertLifeline(sj, teamId, lifeline);
  const active = sj.active!;
  sj.lifelines[teamId]![lifeline] = false;

  if (lifeline === Lifeline.CALL_FRIEND) {
    active.endsAt += SEEN_JEEM.CALL_FRIEND_EXTRA_SEC * 1000;
    return { lifeline: Lifeline.CALL_FRIEND, endsAt: active.endsAt };
  }
  if (lifeline === Lifeline.DISCARD) {
    const wrong = (ctx.optionIds ?? []).filter((id) => id !== ctx.correctOptionId);
    const removed = wrong.slice(0, SEEN_JEEM.DISCARD_REMOVES);
    active.removedOptionIds = removed;
    return { lifeline: Lifeline.DISCARD, removedOptionIds: removed };
  }
  active.doubled = true;
  return { lifeline: Lifeline.DOUBLE, doubled: true };
}

// ──────────────────────────────── Answer / resolve ──────────────────────────

export function assertAnswerable(
  sj: LiveSeenJeem,
  teamId: string,
  cellId: string,
  now: number,
): void {
  if (sj.phase !== SeenJeemPhase.ANSWERING || !sj.active) {
    throw new AppError(ErrorCode.INVALID_STATE, 'No open question');
  }
  if (sj.active.cellId !== cellId) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Stale cell');
  }
  if (sj.active.answeringTeamId !== teamId) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Not your question');
  }
  if (now > sj.active.endsAt) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Answer window closed');
  }
}

/** Record the answering team's chosen option (idempotent: first write wins). */
export function recordAnswer(sj: LiveSeenJeem, optionId: string): void {
  if (!sj.active) throw new AppError(ErrorCode.INVALID_STATE, 'No open question');
  if (sj.active.selectedOptionId == null) {
    sj.active.selectedOptionId = optionId;
    sj.active.answeredBy = sj.active.answeringTeamId;
  }
}

export interface CellResolution {
  cell: SJCell;
  isCorrect: boolean;
  selectedOptionId: string | null;
  answeringTeamId: string;
  pointsAwarded: number;
  nextTeamId: string;
  complete: boolean;
}

/**
 * Settle the open cell. `isCorrect` is decided by the orchestrator (exact MCQ
 * match, or a host ruling for spoken answers). Awards points (doubled if DOUBLE
 * was spent), consumes the cell, mutates `teams`, advances the turn, and reports
 * whether the board is now exhausted.
 */
export function resolveCell(
  sj: LiveSeenJeem,
  teams: ScoreMap,
  isCorrect: boolean,
): CellResolution {
  const active = sj.active;
  if (!active) throw new AppError(ErrorCode.INVALID_STATE, 'No open question');
  const cell = sj.board.find((c) => c.cellId === active.cellId);
  if (!cell) throw new AppError(ErrorCode.INTERNAL, 'Open cell vanished');

  const multiplier = active.doubled ? SEEN_JEEM.DOUBLE_MULTIPLIER : 1;
  const pointsAwarded = isCorrect ? cell.points * multiplier : 0;
  const answeringTeamId = active.answeringTeamId;

  cell.consumed = true;
  cell.awardedTeamId = answeringTeamId;
  cell.awardedPoints = pointsAwarded;
  if (teams[answeringTeamId]) teams[answeringTeamId]!.score += pointsAwarded;

  const selectedOptionId = active.selectedOptionId ?? null;
  sj.active = undefined;

  // Advance the turn. Strict alternation; guard against handing the turn to a
  // team with nothing left to play.
  const other = sj.teamIds[0] === answeringTeamId ? sj.teamIds[1] : sj.teamIds[0];
  const complete = remainingCells(sj).length === 0;

  let nextTeamId = other;
  if (!complete) {
    if (remainingForTeam(sj, other).length === 0) nextTeamId = answeringTeamId;
    sj.turnTeamId = nextTeamId;
    sj.phase = SeenJeemPhase.SELECT;
  } else {
    nextTeamId = answeringTeamId;
    sj.phase = SeenJeemPhase.COMPLETE;
  }

  return {
    cell,
    isCorrect,
    selectedOptionId,
    answeringTeamId,
    pointsAwarded,
    nextTeamId,
    complete,
  };
}

export interface SeenJeemWinner {
  winnerTeamId?: string;
  tie: boolean;
  scores: Record<string, number>;
}

/** Highest score wins; equal scores → tie (no winner). */
export function evaluateWinner(sj: LiveSeenJeem, teams: ScoreMap): SeenJeemWinner {
  const scores: Record<string, number> = {};
  for (const t of sj.teamIds) scores[t] = teams[t]?.score ?? 0;
  const [a, b] = sj.teamIds;
  if (scores[a] === scores[b]) return { tie: true, scores };
  return { winnerTeamId: scores[a]! > scores[b]! ? a : b, tie: false, scores };
}

// ─────────────────────────── Board construction helper ──────────────────────

/**
 * Build the point-tiered cells for one owned category from its question pool.
 * Each of POINT_TIERS appears twice (6 cells). If the pool is short, tiers reuse
 * questions round-robin so a category always fills its board.
 */
export function buildCategoryCells(
  categoryId: string,
  pool: { questionId: string; correctOptionId: string }[],
  idFor: (categoryId: string, points: number, slot: number) => string,
): SJCell[] {
  if (pool.length === 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `Category ${categoryId} has no questions`);
  }
  const tiers: number[] = [];
  for (const tier of SEEN_JEEM.POINT_TIERS) tiers.push(tier, tier);
  return tiers.map((points, slot) => {
    const q = pool[slot % pool.length]!;
    return {
      cellId: idFor(categoryId, points, slot),
      categoryId,
      points,
      questionId: q.questionId,
      correctOptionId: q.correctOptionId,
      consumed: false,
    };
  });
}
