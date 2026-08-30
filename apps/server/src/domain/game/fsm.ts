/**
 * Game finite-state-machine guards (pure). Encodes which intents are legal in
 * which state (doc 06 §2.1). The engine calls these before mutating; illegal
 * intents are rejected with INVALID_STATE rather than corrupting the game.
 */
import { AppError, ErrorCode, GameMode, GameStatus, GameType, RoundPhase } from '@tahaddi/shared';
import type { RoomState } from '../rooms/types.js';

/** Legal Game status transitions. */
const STATUS_TRANSITIONS: Record<GameStatus, GameStatus[]> = {
  LOBBY: ['ACTIVE', 'ABANDONED'],
  ACTIVE: ['PAUSED', 'COMPLETED', 'ABANDONED'],
  PAUSED: ['ACTIVE', 'COMPLETED', 'ABANDONED'],
  COMPLETED: [],
  ABANDONED: [],
};

export function canTransition(from: GameStatus, to: GameStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: GameStatus, to: GameStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(ErrorCode.INVALID_STATE, `Illegal transition ${from} → ${to}`);
  }
}

/** Players may only join while in the LOBBY. */
export function assertJoinable(state: RoomState): void {
  if (state.status !== GameStatus.LOBBY) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Game already started');
  }
}

/**
 * The host may start only from LOBBY, with enough players, and once every phone in
 * the room has finished its lobby step (client 2026-08-30: «ابدأ اللعب» used to go
 * live the moment two players joined, so team games started with players still on
 * «اختر فريقك» and paid games with nobody's category picked).
 *
 * Only ACTIVE players are counted — a phone that dropped is neither blocking the
 * start nor making up the minimum.
 */
export function assertStartable(state: RoomState): void {
  if (state.status !== GameStatus.LOBBY) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Game already started');
  }
  const players = Object.values(state.participants).filter((p) => p.status === 'ACTIVE');
  if (players.length < state.settings.minPlayers) {
    throw new AppError(ErrorCode.INVALID_STATE, `Need at least ${state.settings.minPlayers} players`);
  }
  if (state.mode === GameMode.SEEN_JEEM) return; // its own board setup, no lobby picks

  if (state.type === GameType.TEAMS) {
    if (players.some((p) => !p.teamId)) {
      throw new AppError(ErrorCode.INVALID_STATE, 'كل لاعب لازم يختار فريقه قبل بدء اللعب');
    }
    const teams = Object.values(state.teams);
    if (teams.length < 2 || teams.some((t) => !players.some((p) => p.teamId === t.id))) {
      throw new AppError(ErrorCode.INVALID_STATE, 'كل فريق يحتاج لاعباً واحداً على الأقل');
    }
  }
  if (state.settings.perPlayerCategory && players.some((p) => !p.categoryId)) {
    throw new AppError(ErrorCode.INVALID_STATE, 'كل لاعب لازم يختار فئته قبل بدء اللعب');
  }
}

/**
 * An answer is acceptable only when: game ACTIVE, a current round exists, it is
 * COLLECTING, matches the round the client thinks it's answering, and the window
 * has not closed. Returns the round on success.
 */
export function assertAnswerable(state: RoomState, roundId: string) {
  if (state.status !== GameStatus.ACTIVE) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Game is not active');
  }
  const round = state.currentRound;
  if (!round || round.phase !== RoundPhase.COLLECTING) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Not accepting answers');
  }
  if (round.roundId !== roundId) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Stale round');
  }
  if (Date.now() > round.endsAt) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Answer window closed');
  }
  return round;
}
