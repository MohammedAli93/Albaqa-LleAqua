/**
 * Seen-Jeem integration test — drives the real orchestrator (seenJeemEngine) end
 * to end with the I/O ports faked: an in-memory room store, a stub Prisma, no-op
 * timers, and a capturing emitter. This proves the wiring (start → draft → select
 * → lifeline → answer → resolve → finish), not just the pure core.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_GAME_SETTINGS, GameMode, ServerEvent, Lifeline } from '@tahaddi/shared';

// ── Hoisted fakes (shared between vi.mock factories and the test body) ──
const h = vi.hoisted(() => {
  const store = new Map<string, any>();
  const counters = { team: 0 };
  const prisma = {
    team: {
      create: async ({ data }: any) => ({ id: `team-${counters.team++}`, name: data.name, color: data.color }),
    },
    participant: { update: async () => ({}) },
    game: { update: async () => ({}) },
    gameResult: { create: async () => ({}) },
    lifelineUsage: { create: async () => ({}) },
    packageQuestion: {
      findMany: async ({ where }: any) => {
        if (where?.question?.categoryId) {
          const cat = where.question.categoryId;
          return Array.from({ length: 6 }, (_, k) => ({
            question: { id: `${cat}-q${k}`, correctOptionId: 'a', difficulty: 'MEDIUM' },
          }));
        }
        return Array.from({ length: 6 }, (_, i) => ({
          question: {
            categoryId: `cat${i}`,
            category: { nameAr: `فئة ${i}`, nameEn: null, color: '#7C3AED', icon: null },
          },
        }));
      },
    },
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
        { id: 'c', textAr: 'ج' },
        { id: 'd', textAr: 'د' },
      ],
    },
    correctOptionId: 'a',
    timeLimitSec: 45,
    basePoints: 0,
    speedBonus: false,
  });
  return { store, counters, prisma, loadQuestion };
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

import { setEmitter } from '../src/domain/game/emitterRef.js';
import {
  startSeenJeem,
  draftPick,
  cellSelect,
  lifelineUse,
  teamAnswer,
} from '../src/domain/game/seenJeemEngine.js';

const GAME = 'g1';

function seedRoom() {
  const mk = (id: string, joinOrder: number) => ({
    id,
    nickname: id,
    avatarId: 'falcon',
    status: 'ACTIVE',
    score: 0,
    lives: 1,
    joinOrder,
    sessionTokenHash: `h-${id}`,
  });
  h.store.set(GAME, {
    gameId: GAME,
    roomCode: 'ABC123',
    mode: GameMode.SEEN_JEEM,
    status: 'LOBBY',
    settings: { ...DEFAULT_GAME_SETTINGS, mode: GameMode.SEEN_JEEM },
    hostTokenHash: 'host',
    packageId: 'pkg',
    questionOrder: [],
    roundIndex: -1,
    totalRounds: 0,
    participants: { p1: mk('p1', 0), p2: mk('p2', 1) },
    teams: {},
    currentRound: null,
    createdAt: 0,
  });
}

const state = () => h.store.get(GAME);

describe('Seen-Jeem orchestrator (integration)', () => {
  const events: { event: string; payload: any }[] = [];

  beforeEach(() => {
    h.store.clear();
    h.counters.team = 0;
    events.length = 0;
    setEmitter({
      toRoom: (_g, event, payload) => events.push({ event, payload: payload as any }),
      toSocket: () => {},
    });
    seedRoom();
  });

  it('plays a full game start → draft → board → resolve → winner', async () => {
    await startSeenJeem(GAME);

    const sj0 = state().seenJeem;
    expect(sj0.phase).toBe('DRAFT');
    expect(Object.keys(state().teams)).toEqual(['team-0', 'team-1']);
    expect(events.map((e) => e.event)).toEqual(
      expect.arrayContaining([ServerEvent.GAME_STARTED, ServerEvent.ROOM_STATE, ServerEvent.SJ_STATE]),
    );

    // Draft all six categories following the alternating order.
    for (let i = 0; i < 6; i++) {
      const sj = state().seenJeem;
      const team = sj.draftOrder[sj.draftIndex];
      const cat = sj.categories.find((c: any) => !c.ownerTeamId).categoryId;
      await draftPick(GAME, team, cat);
    }
    expect(state().seenJeem.phase).toBe('SELECT');
    expect(state().seenJeem.board).toHaveLength(36);

    // Play every cell. team-0 answers correctly, team-1 wrong; team-0 doubles its
    // first cell (a 200) → +200, so team-0 finishes on 7400.
    let usedDouble = false;
    let guard = 0;
    while (state().seenJeem.phase !== 'COMPLETE') {
      if (guard++ > 100) throw new Error('did not terminate');
      const sj = state().seenJeem;
      const team = sj.turnTeamId;
      const owned = new Set(
        sj.categories.filter((c: any) => c.ownerTeamId === team).map((c: any) => c.categoryId),
      );
      const cell = sj.board.find((c: any) => owned.has(c.categoryId) && !c.consumed);
      await cellSelect(GAME, team, cell.cellId);
      if (team === 'team-0' && !usedDouble) {
        await lifelineUse(GAME, 'team-0', Lifeline.DOUBLE);
        usedDouble = true;
      }
      await teamAnswer(GAME, team, cell.cellId, team === 'team-0' ? 'a' : 'z');
    }

    expect(state().teams['team-0'].score).toBe(7400);
    expect(state().teams['team-1'].score).toBe(0);

    const completed = events.find((e) => e.event === ServerEvent.GAME_COMPLETED);
    expect(completed).toBeTruthy();
    expect(completed!.payload.winnerTeam.id).toBe('team-0');

    // The lifeline + at least one resolve were emitted with the right shape.
    const lifeline = events.find((e) => e.event === ServerEvent.SJ_LIFELINE_USED);
    expect(lifeline!.payload).toMatchObject({ teamId: 'team-0', lifeline: Lifeline.DOUBLE, doubled: true });
    const resolved = events.find(
      (e) => e.event === ServerEvent.SJ_CELL_RESOLVED && e.payload.answeringTeamId === 'team-0',
    );
    expect(resolved!.payload.isCorrect).toBe(true);
  });

  it('rejects an out-of-turn cell selection', async () => {
    await startSeenJeem(GAME);
    for (let i = 0; i < 6; i++) {
      const sj = state().seenJeem;
      await draftPick(GAME, sj.draftOrder[sj.draftIndex], sj.categories.find((c: any) => !c.ownerTeamId).categoryId);
    }
    const sj = state().seenJeem;
    const wrongTeam = sj.turnTeamId === 'team-0' ? 'team-1' : 'team-0';
    const theirCell = sj.board.find((c: any) =>
      sj.categories.find((cat: any) => cat.categoryId === c.categoryId)?.ownerTeamId === wrongTeam,
    );
    await expect(cellSelect(GAME, wrongTeam, theirCell.cellId)).rejects.toThrow(/Not your turn/);
  });
});
