/**
 * INDIVIDUAL elimination — integration test against the real engine with the I/O
 * ports faked (in-memory room store, stub Prisma, no-op timers, capturing emitter).
 *
 * Pins the fix for the client's 2026-08-30 report: two players both down to 1/3
 * lives who both answered wrong left the match permanently unwinnable. The "never
 * wipe everyone" safety net refused to take anyone's last life, so no one was ever
 * eliminated, the round loop kept appending «جولة إضافية» questions and the host's
 * game-credit was already spent.
 *
 * These drive the loop through the actual round pipeline (startNextRound →
 * submitAnswer/resolveRound) and assert that it TERMINATES with a champion.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ELIMINATION_SETTINGS,
  GameType,
  GameMode,
  ParticipantStatus,
  ServerEvent,
} from '@tahaddi/shared';

const h = vi.hoisted(() => {
  const store = new Map<string, any>();
  const prisma = {
    participant: { update: async () => ({}) },
    game: { update: async () => ({}), findUnique: async () => null, updateMany: async () => ({ count: 0 }) },
    gameResult: { create: async () => ({}) },
    round: { create: async () => ({}), update: async () => ({}) },
    answer: { create: async () => ({}) },
    player: { update: async () => ({}) },
    packageQuestion: { findMany: async () => [{ questionId: 'qX' }, { questionId: 'qY' }] },
    $transaction: async (arr: Promise<unknown>[]) => Promise.all(arr),
  };
  const loadQuestion = async (questionId: string) => ({
    questionId,
    publicQuestion: {
      id: questionId,
      type: 'MULTIPLE_CHOICE',
      difficulty: 'MEDIUM',
      promptAr: 'سؤال؟',
      options: [
        { id: 'a', textAr: 'أ' },
        { id: 'b', textAr: 'ب' },
      ],
    },
    correctOptionId: 'a',
    timeLimitSec: 15,
    basePoints: 100,
    speedBonus: false,
  });
  return { store, prisma, loadQuestion };
});

vi.mock('../src/lib/prisma.js', () => ({ prisma: h.prisma }));
vi.mock('../src/domain/rooms/roomStore.js', () => ({
  getRoom: async (id: string) => h.store.get(id) ?? null,
  saveRoom: async (s: any) => void h.store.set(s.gameId, s),
  deleteRoom: async () => {},
}));
vi.mock('../src/domain/content/questionLoader.js', () => ({ loadQuestion: h.loadQuestion }));
vi.mock('../src/domain/rooms/roomService.js', () => ({
  buildPerPlayerOrder: async () => ({ questionOrder: [], roundOwners: [] }),
  pickCategoryQuestion: async () => null,
  pickAnyUnusedQuestion: async (used: Set<string>) => `extra-${used.size}`,
}));
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
vi.mock('../src/domain/game/profileStats.js', () => ({ profileStatUpdates: () => [] }));

import { initEngine, startNextRound, submitAnswer, resolveRound } from '../src/domain/game/engine.js';

const GAME = 'g-elim';
type Emitted = { event: string; payload: any };
let emitted: Emitted[] = [];

/** Two players, each on their LAST life — the exact state the testers reported. */
function seedRoom(lives = 1, totalRounds = 15) {
  const mk = (id: string, joinOrder: number, correctCount: number, speedMs: number) => ({
    id,
    nickname: id,
    avatarId: 'falcon',
    status: ParticipantStatus.ACTIVE,
    score: 0,
    lives,
    joinOrder,
    correctCount,
    speedMs,
    sessionTokenHash: `h-${id}`,
  });
  h.store.set(GAME, {
    gameId: GAME,
    roomCode: 'ELIM01',
    type: GameType.INDIVIDUAL,
    mode: GameMode.ELIMINATION,
    status: 'ACTIVE',
    settings: { ...ELIMINATION_SETTINGS, autoAdvance: false, intermissionSec: 0 },
    hostTokenHash: 'host',
    packageId: 'pkg',
    questionOrder: ['q1'],
    roundIndex: -1,
    totalRounds,
    participants: {
      // p1 has the better record, so it is the one the decider keeps in.
      p1: mk('p1', 0, 9, 4000),
      p2: mk('p2', 1, 3, 9000),
    },
    teams: {},
    currentRound: null,
    createdAt: 0,
  });
}

const room = () => h.store.get(GAME);

/** Let the clock run out on the open round — nobody answers, so everybody is wrong. */
async function timeOutRound(): Promise<void> {
  const st = room();
  st.currentRound.startedAt = Date.now() - 20_000;
  st.currentRound.endsAt = Date.now() - 1000;
  await resolveRound(GAME);
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

/** Everyone answers — `picks` maps participant id to the option they choose. */
async function answerRound(picks: Record<string, string>): Promise<void> {
  const st = room();
  st.currentRound.startedAt = Date.now() - 1000;
  st.currentRound.endsAt = Date.now() + 10_000;
  const roundId = st.currentRound.roundId;
  let ms = 0;
  for (const [pid, opt] of Object.entries(picks)) {
    ms += 50; // stagger, so "fastest correct" is deterministic
    await new Promise((r) => setTimeout(r, 1));
    await submitAnswer(GAME, pid, roundId, opt);
  }
  void ms;
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

const completed = () => emitted.find((e) => e.event === ServerEvent.GAME_COMPLETED);
/** Players still in the running, straight off the room state. */
const alive = (): any[] =>
  Object.values(room().participants).filter((p: any) => p.status === ParticipantStatus.ACTIVE);

beforeEach(() => {
  emitted = [];
  h.store.clear();
  seedRoom();
  initEngine({
    toRoom: (_g: string, event: string, payload: unknown) => emitted.push({ event, payload }),
    toSocket: () => {},
  } as never);
});

describe('elimination deadlock — the match always reaches a champion', () => {
  it('replays the question free of charge the first time both last-lifers miss', async () => {
    await startNextRound(GAME);
    await timeOutRound();

    // Nobody out, nobody charged a life — and the room says so.
    expect(room().participants.p1.lives).toBe(1);
    expect(room().participants.p2.lives).toBe(1);
    expect(room().participants.p1.status).toBe(ParticipantStatus.ACTIVE);
    expect(room().participants.p2.status).toBe(ParticipantStatus.ACTIVE);
    expect(completed()).toBeUndefined();
    const recap = emitted.filter((e) => e.event === ServerEvent.ROUND_COMPLETED).pop();
    expect(recap?.payload.stalemate).toBe(true);
  });

  it('settles the match instead of looping forever when they keep missing', async () => {
    // The exact reported scenario: both on 1/3, both wrong, round after round.
    for (let i = 0; i < 6 && !completed(); i++) {
      await startNextRound(GAME);
      await timeOutRound();
    }

    const done = completed();
    expect(done).toBeDefined();
    // A single champion — the better record (more correct, faster) survives.
    expect(done!.payload.winner?.id).toBe('p1');
    expect(room().participants.p2.status).toBe(ParticipantStatus.ELIMINATED);
    expect(room().status).toBe('COMPLETED');
  });

  it('a correct answer still resets the streak — the decider only follows misses', async () => {
    await startNextRound(GAME);
    await timeOutRound(); // stalemate 1
    expect(room().stalemateStreak).toBe(1);

    await startNextRound(GAME);
    await answerRound({ p1: 'a', p2: 'a' }); // both right → normal round
    expect(room().stalemateStreak).toBe(0);
    expect(completed()).toBeUndefined();
  });

  it('a normal round is unaffected: the one who missed loses the match', async () => {
    await startNextRound(GAME);
    await answerRound({ p1: 'a', p2: 'b' }); // p2 wrong on its last life

    expect(room().participants.p2.status).toBe(ParticipantStatus.ELIMINATED);
    expect(alive()).toHaveLength(1);

    // The engine holds the reveal before crowning; the next advance concludes.
    await startNextRound(GAME);
    expect(completed()?.payload.winner?.id).toBe('p1');
  });

  it('caps an endless duel: past the overtime limit the fastest correct survives', async () => {
    // Both on full lives and never missing — before the fix this ran forever.
    h.store.clear();
    seedRoom(3, 2); // totalRounds 2, so overtime starts early
    emitted = [];

    let rounds = 0;
    while (alive().length > 1 && room().status === 'ACTIVE' && rounds < 60) {
      rounds++;
      await startNextRound(GAME);
      // p1 answers first (faster), p2 second — both correct, every single round.
      await answerRound({ p1: 'a', p2: 'a' });
    }

    expect(rounds).toBeLessThan(60); // it terminated on its own, not on the guard
    expect(alive()).toHaveLength(1);
    expect(alive()[0]!.id).toBe('p1'); // the faster answer survives
  });
});
