/**
 * Game finite-state-machine guards (pure). Encodes which intents are legal in
 * which state (doc 06 §2.1). The engine calls these before mutating; illegal
 * intents are rejected with INVALID_STATE rather than corrupting the game.
 */
import { AppError, ErrorCode, GameStatus, RoundPhase } from '@tahaddi/shared';
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

/** The host may start only from LOBBY with enough players. */
export function assertStartable(state: RoomState): void {
  if (state.status !== GameStatus.LOBBY) {
    throw new AppError(ErrorCode.INVALID_STATE, 'Game already started');
  }
  const count = Object.values(state.participants).filter((p) => p.status === 'ACTIVE').length;
  if (count < state.settings.minPlayers) {
    throw new AppError(ErrorCode.INVALID_STATE, `Need at least ${state.settings.minPlayers} players`);
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
