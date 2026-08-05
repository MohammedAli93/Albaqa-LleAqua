/**
 * TEAMS turn-based points — integration test against the real engine with the I/O
 * ports faked (in-memory room store, stub Prisma, no-op timers, capturing emitter).
 *
 * Pins the client rule (2026-08-06):
 *   Q1 → team A. Correct  → Q2 goes to team B.
 *   Q1 → team A. Wrong    → the SAME question re-opens for team B (steal, full
 *                           point), and afterwards team B still gets its own Q2.
 * Plus the two things that are easy to get wrong: the correct answer must NOT be
 * revealed while a steal is pending, and a steal must not consume a question.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_GAME_SETTINGS, GameType, GameMode, ServerEvent } from '@tahaddi/shared';

const h = vi.hoisted(() => {
  const store = new Map<string, any>();
  const prisma = {
    participant: { update: async () => ({}) },
    game: { update: async () => ({}) },
    gameResult: { create: async () => ({}) },
    round: { create: async () => ({}), update: async () => ({}) },
    answer: { create: async () => ({}) },
    player: { update: async () => ({}) },
    $transaction: async (arr: Promise<unknown>[]) => Promise.all(arr),
  };
  const loadQuestion = async (questionId: string) => ({
    questionId,
    publicQuestion: {
      id: questionId,
      type: 'MULTIPLE_CHOICE',
      difficulty: 'MEDIUM',
      promptAr: '؟',
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
vi.mock('../src/domain/game/profileStats.js', () => ({ applyProfileStats: async () => {} }));

import { initEngine, startNextRound, submitAnswer, resolveRound } from '../src/domain/game/engine.js';

const GAME = 'g1';
type Emitted = { event: string; payload: any };
let emitted: Emitted[] = [];

function seedRoom() {
  const mk = (id: string, teamId: string, joinOrder: number) => ({
    id,
    nickname: id,
    avatarId: 'falcon',
    status: 'ACTIVE',
    score: 0,
    lives: 1,
    joinOrder,
    teamId,
    sessionTokenHash: `h-${id}`,
  });
  h.store.set(GAME, {
    gameId: GAME,
    roomCode: 'ABC123',
    type: GameType.TEAMS,
    mode: GameMode.POINTS,
    status: 'ACTIVE',
    settings: {
      ...DEFAULT_GAME_SETTINGS,
      type: GameType.TEAMS,
      mode: GameMode.POINTS,
      autoAdvance: false, // drive the loop by hand so the assertions are deterministic
    },
    hostTokenHash: 'host',
    packageId: 'pkg',
    questionOrder: ['q1', 'q2', 'q3', 'q4'],
    roundIndex: -1,
    totalRounds: 4,
    participants: { a1: mk('a1', 'A', 0), b1: mk('b1', 'B', 1) },
    teams: {
      A: { id: 'A', name: 'الصقور', color: '#f00', score: 0, winMs: 0, lives: 1, capacity: null },
      B: { id: 'B', name: 'النمور', color: '#00f', score: 0, winMs: 0, lives: 1, capacity: null },
    },
    teamOrder: ['A', 'B'],
    currentRound: null,
    createdAt: 0,
  });
}

const room = () => h.store.get(GAME);

/**
 * Answer as `pid`. The engine rejects answers during the 3-2-1 pre-roll, so we
 * age the round into its live window first. `submitAnswer` kicks off
 * `resolveRound` fire-and-forget, so we flush the microtask/macrotask queue
 * afterwards and the assertions see the settled state.
 */
async function answer(pid: string, optionId: string): Promise<void> {
  const st = room();
  st.currentRound.startedAt = Date.now() - 1000;
  st.currentRound.endsAt = Date.now() + 10_000;
  await submitAnswer(GAME, pid, st.currentRound.roundId, optionId);
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}
const shows = () => emitted.filter((e) => e.event === ServerEvent.QUESTION_SHOW).map((e) => e.payload);
const lastShow = () => shows()[shows().length - 1];

beforeEach(() => {
  emitted = [];
  h.store.clear();
  seedRoom();
  initEngine({
    toRoom: (_g: string, event: string, payload: unknown) => emitted.push({ event, payload }),
    toSocket: () => {},
  } as never);
});

describe('TEAMS points — turn-based questions', () => {
  it('asks the first question to the first team in the ring', async () => {
    await startNextRound(GAME);
    expect(lastShow().turnTeam).toMatchObject({ teamId: 'A', name: 'الصقور' });
    expect(room().currentRound.answeringTeamId).toBe('A');
  });

  it('rejects an answer from the team that is not on the clock', async () => {
    await startNextRound(GAME);
    const st = room();
    st.currentRound.startedAt = Date.now() - 1000;
    st.currentRound.endsAt = Date.now() + 10_000;
    await expect(submitAnswer(GAME, 'b1', st.currentRound.roundId, 'a')).rejects.toThrow();
  });

  it('a correct answer moves the next question to the other team', async () => {
    await startNextRound(GAME);
    await answer('a1', 'a'); // correct → resolves early

    expect(room().teams.A.score).toBe(1);
    expect(room().teams.B.score).toBe(0);
    expect(room().pendingSteal).toBeUndefined();
    // The answer is revealed — this question is finished with.
    expect(emitted.some((e) => e.event === ServerEvent.QUESTION_REVEAL)).toBe(true);

    await startNextRound(GAME);
    expect(lastShow().turnTeam).toMatchObject({ teamId: 'B' });
    expect(room().roundIndex).toBe(1); // a new question was consumed
  });

  it('a wrong answer re-opens the SAME question for the other team, then play continues with that team', async () => {
    await startNextRound(GAME);
    await answer('a1', 'b'); // WRONG → steal queued

    // Nobody scored, and team B is owed the steal.
    expect(room().teams.A.score).toBe(0);
    expect(room().pendingSteal).toBe('B');
    const completed = emitted.filter((e) => e.event === ServerEvent.ROUND_COMPLETED).pop()!;
    expect(completed.payload.steal).toBe(true);
    expect(completed.payload.stealTeam).toMatchObject({ teamId: 'B' });

    // CRITICAL: the correct answer must stay secret — team B is about to answer it.
    expect(emitted.some((e) => e.event === ServerEvent.QUESTION_REVEAL)).toBe(false);

    // The steal re-opens the same question for team B without consuming one.
    await startNextRound(GAME);
    const steal = lastShow();
    expect(steal.steal).toBe(true);
    expect(steal.turnTeam).toMatchObject({ teamId: 'B' });
    expect(steal.question.id).toBe('q1'); // same question
    expect(room().roundIndex).toBe(0); // no question consumed
    expect(room().pendingSteal).toBeUndefined(); // claimed

    // Team B steals it for the FULL point.
    await answer('b1', 'a');
    expect(room().teams.B.score).toBe(1);
    expect(emitted.some((e) => e.event === ServerEvent.QUESTION_REVEAL)).toBe(true);

    // …and team B still gets its own next question ("ثم ننتقل للسؤال الثاني للفريق الثاني").
    await startNextRound(GAME);
    expect(lastShow().turnTeam).toMatchObject({ teamId: 'B' });
    expect(lastShow().question.id).toBe('q2');
  });

  it('a timeout is treated as a miss and also hands the question over', async () => {
    await startNextRound(GAME);
    await resolveRound(GAME); // nobody answered
    expect(room().pendingSteal).toBe('B');
    expect(emitted.some((e) => e.event === ServerEvent.QUESTION_REVEAL)).toBe(false);
  });

  it('a missed steal ends the question — it is never stolen back', async () => {
    await startNextRound(GAME);
    await resolveRound(GAME); // team A misses → steal queued for B
    await startNextRound(GAME); // steal opens for B
    expect(room().currentRound.isSteal).toBe(true);

    await resolveRound(GAME); // team B misses too
    expect(room().pendingSteal).toBeUndefined(); // no infinite ping-pong
    expect(room().teams.A.score).toBe(0);
    expect(room().teams.B.score).toBe(0);
    // Question finished with → now it's safe to reveal.
    expect(emitted.some((e) => e.event === ServerEvent.QUESTION_REVEAL)).toBe(true);

    await startNextRound(GAME);
    expect(lastShow().question.id).toBe('q2');
    expect(lastShow().turnTeam).toMatchObject({ teamId: 'B' });
  });
});
