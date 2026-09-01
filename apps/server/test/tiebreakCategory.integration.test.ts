/**
 * The decisive (sudden-death) question comes from a category the PLAYERS chose.
 *
 * Client 2026-09-01, point 4: «تم اختيار فئتي السيارات والتقنية، ولكن عند التعادل ظهر
 * السؤال الحاسم من فئة فنانون عرب وأجانب» — the tie-breaker was drawn from the whole
 * bank, so the game changed subject at the one moment the players were watching it
 * most closely. It now walks the tied contenders' categories first, then the other
 * categories in play, and only widens to the rest of the bank when every one of them
 * is exhausted.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_GAME_SETTINGS, GameType, GameMode } from '@tahaddi/shared';

const CARS = 'cat-cars';
const TECH = 'cat-tech';
const ART = 'cat-artists';

const h = vi.hoisted(() => {
  const store = new Map<string, any>();
  /** Which category each pickCategoryQuestion call asked for, in order. */
  const asked: string[] = [];
  /** Categories that still have an unused question to give. */
  const stocked = new Set<string>();
  const prisma = {
    participant: { update: async () => ({}) },
    game: { update: async () => ({}) },
    gameResult: { create: async () => ({}) },
    round: { create: async () => ({}), update: async () => ({}) },
    player: { update: async () => ({}) },
    packageQuestion: { findMany: async () => [{ questionId: 'pkg-1' }] },
    $transaction: async (arr: Promise<unknown>[]) => Promise.all(arr),
  };
  const loadQuestion = async (questionId: string) => ({
    questionId,
    publicQuestion: {
      id: questionId,
      type: 'MULTIPLE_CHOICE',
      difficulty: 'MEDIUM',
      promptAr: '؟',
      options: [{ id: 'a', textAr: 'أ' }, { id: 'b', textAr: 'ب' }],
    },
    correctOptionId: 'a',
    timeLimitSec: 15,
    basePoints: 100,
    speedBonus: false,
  });
  return { store, prisma, loadQuestion, asked, stocked };
});

vi.mock('../src/lib/prisma.js', () => ({ prisma: h.prisma }));
vi.mock('../src/domain/rooms/roomStore.js', () => ({
  getRoom: async (id: string) => h.store.get(id) ?? null,
  saveRoom: async (s: any) => void h.store.set(s.gameId, s),
  deleteRoom: async () => {},
}));
vi.mock('../src/domain/content/questionLoader.js', () => ({ loadQuestion: h.loadQuestion }));
vi.mock('../src/domain/game/lock.js', () => ({
  withRoomLock: (_g: string, fn: () => unknown) => fn(),
  acquireRoomLock: async () => async () => {},
}));
vi.mock('../src/domain/game/timer.js', () => ({
  scheduleRoundEnd: () => {},
  clearRoundTimer: () => {},
  scheduleTicks: () => {},
  clearTicks: () => {},
  clearAllTimers: () => {},
}));
vi.mock('../src/domain/rooms/roomService.js', () => ({
  buildPerPlayerOrder: async () => ({ questionOrder: [], roundOwners: [] }),
  pickCategoryQuestion: async (categoryId: string) => {
    h.asked.push(categoryId);
    return h.stocked.has(categoryId) ? `q-${categoryId}` : null;
  },
  pickAnyUnusedQuestion: async () => 'q-whole-bank',
  guardForAskedQuestions: async () => ({ accept: () => true }),
}));

import { initEngine, startNextRound } from '../src/domain/game/engine.js';

const GAME = 'g-tie';

/** A finished TEAMS game, level on points, waiting on its decisive question. */
function seedTiedRoom() {
  const mk = (id: string, teamId: string, joinOrder: number, categoryId: string) => ({
    id, nickname: id, avatarId: 'falcon', status: 'ACTIVE', score: 1, lives: 1,
    joinOrder, teamId, categoryId, correctCount: 1, speedMs: 0, sessionTokenHash: `h-${id}`,
  });
  h.store.set(GAME, {
    gameId: GAME,
    roomCode: 'TIE123',
    type: GameType.TEAMS,
    mode: GameMode.POINTS,
    status: 'ACTIVE',
    settings: {
      ...DEFAULT_GAME_SETTINGS,
      type: GameType.TEAMS,
      mode: GameMode.POINTS,
      perPlayerCategory: true,
      autoAdvance: false,
    },
    hostTokenHash: 'host',
    packageId: 'pkg',
    questionOrder: ['q1'],
    roundIndex: 0,
    totalRounds: 1,
    participants: {
      a1: mk('a1', 'A', 0, CARS),
      b1: mk('b1', 'B', 1, TECH),
      c1: mk('c1', 'C', 2, ART), // a third team, already out of the running
    },
    teams: {
      A: { id: 'A', name: 'الصقور', color: '#f00', score: 5, winMs: 0, lives: 1, capacity: null, leaderId: 'a1' },
      B: { id: 'B', name: 'النمور', color: '#00f', score: 5, winMs: 0, lives: 1, capacity: null, leaderId: 'b1' },
      C: { id: 'C', name: 'الذئاب', color: '#0f0', score: 1, winMs: 0, lives: 1, capacity: null, leaderId: 'c1' },
    },
    teamOrder: ['A', 'B', 'C'],
    // The tie is already declared: teams A and B are level at the top.
    tiebreak: { contenders: ['A', 'B'], isTeam: true },
    currentRound: null,
    createdAt: 0,
  });
}

beforeEach(() => {
  h.store.clear();
  h.asked.length = 0;
  h.stocked.clear();
  seedTiedRoom();
  initEngine({ toRoom: () => {}, toSocket: () => {} } as never);
});

describe('decisive question — category', () => {
  it('draws from a category one of the TIED teams picked', async () => {
    h.stocked.add(CARS);
    h.stocked.add(TECH);
    h.stocked.add(ART);
    await startNextRound(GAME);

    expect(h.store.get(GAME).currentRound.questionId).toMatch(/^q-(cat-cars|cat-tech)$/);
    // The eliminated third team's category is never even consulted first.
    expect(h.asked[0]).not.toBe(ART);
  });

  it('falls back to another category in play before widening to the bank', async () => {
    h.stocked.add(ART); // the contenders' categories are spent; a third team's isn't
    await startNextRound(GAME);

    expect(h.store.get(GAME).currentRound.questionId).toBe(`q-${ART}`);
    expect(h.asked.slice(0, 2).sort()).toEqual([CARS, TECH].sort());
  });

  it('widens to the whole bank only when every chosen category is exhausted', async () => {
    await startNextRound(GAME);

    expect(h.store.get(GAME).currentRound.questionId).toBe('q-whole-bank');
    expect(h.asked.sort()).toEqual([ART, CARS, TECH].sort());
  });
});
