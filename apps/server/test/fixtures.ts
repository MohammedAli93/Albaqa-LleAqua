/** Test fixtures for the pure game logic (no DB/Redis). */
import {
  GameMode,
  GameStatus,
  RoundPhase,
  ParticipantStatus,
  DEFAULT_GAME_SETTINGS,
  type GameSettings,
} from '@tahaddi/shared';
import type { RoomState, LiveParticipant, LiveRound } from '../src/domain/rooms/types.js';

export function makeParticipant(id: string, over: Partial<LiveParticipant> = {}): LiveParticipant {
  return {
    id,
    nickname: id,
    avatarId: 'falcon',
    status: ParticipantStatus.ACTIVE,
    score: 0,
    lives: 1,
    joinOrder: 0,
    sessionTokenHash: `hash-${id}`,
    ...over,
  };
}

export function makeRound(over: Partial<LiveRound> = {}): LiveRound {
  const start = 1_000_000;
  return {
    roundId: 'r1',
    index: 0,
    questionId: 'q1',
    correctOptionId: 'a',
    question: {
      id: 'q1',
      type: 'MULTIPLE_CHOICE',
      difficulty: 'EASY',
      promptAr: '؟',
      options: [
        { id: 'a', textAr: 'أ' },
        { id: 'b', textAr: 'ب' },
      ],
    },
    startedAt: start,
    endsAt: start + 15_000,
    phase: RoundPhase.COLLECTING,
    timeLimitSec: 15,
    basePoints: 100,
    speedBonus: false,
    answers: {},
    ...over,
  };
}

export function makeRoom(
  participants: LiveParticipant[],
  over: Partial<RoomState> = {},
  settings: Partial<GameSettings> = {},
): RoomState {
  return {
    gameId: 'g1',
    roomCode: 'ABC123',
    mode: GameMode.INDIVIDUAL,
    status: GameStatus.ACTIVE,
    settings: { ...DEFAULT_GAME_SETTINGS, ...settings },
    hostTokenHash: 'host',
    packageId: 'p1',
    questionOrder: ['q1', 'q2', 'q3'],
    roundIndex: 0,
    totalRounds: 3,
    participants: Object.fromEntries(participants.map((p) => [p.id, p])),
    teams: {},
    currentRound: null,
    createdAt: 0,
    ...over,
  };
}
