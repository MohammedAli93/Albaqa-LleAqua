/**
 * A paid game-credit must be spent when the host STARTS the game — never when the
 * room is created. A host who opens a room, shares the link and then has to
 * re-create it must not be billed twice. These tests drive the real
 * engine.startGame with its I/O ports faked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_GAME_SETTINGS, GameType, GameMode, GameTier } from '@tahaddi/shared';

const h = vi.hoisted(() => {
  const store = new Map<string, any>();
  /** gameId -> creditChargedAt (mirrors the Game column used as the guard). */
  const charged = new Map<string, Date | null>();
  const calls = { consume: 0 };
  let walletCredits = 1;

  const prisma = {
    game: {
      findUnique: async ({ where }: any) => ({ creditChargedAt: charged.get(where.id) ?? null }),
      update: async ({ where, data }: any) => {
        if ('creditChargedAt' in data) charged.set(where.id, data.creditChargedAt);
        return {};
      },
      updateMany: async ({ where, data }: any) => {
        // Conditional claim: only stamps when creditChargedAt is still null.
        const current = charged.get(where.id) ?? null;
        if (where.creditChargedAt === null && current !== null) return { count: 0 };
        charged.set(where.id, data.creditChargedAt);
        return { count: 1 };
      },
    },
    participant: { update: async () => ({}) },
    packageQuestion: { findMany: async () => [] },
    $transaction: async (arr: Promise<unknown>[]) => Promise.all(arr),
  };

  const consumeCredit = async () => {
    calls.consume++;
    if (walletCredits <= 0) return false;
    walletCredits--;
    return true;
  };

  return {
    store,
    charged,
    calls,
    prisma,
    consumeCredit,
    setWallet: (n: number) => void (walletCredits = n),
    wallet: () => walletCredits,
  };
});

vi.mock('../src/lib/prisma.js', () => ({ prisma: h.prisma }));
vi.mock('../src/domain/rooms/roomStore.js', () => ({
  getRoom: async (id: string) => h.store.get(id) ?? null,
  saveRoom: async (s: any) => void h.store.set(s.gameId, s),
  deleteRoom: async () => {},
}));
vi.mock('../src/domain/payments/paymentService.js', () => ({ consumeCredit: h.consumeCredit }));
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
// startGame kicks off the first round; stub it out so these tests stay about billing.
vi.mock('../src/domain/content/questionLoader.js', () => ({
  loadQuestion: async () => {
    throw new Error('no questions in this test');
  },
}));

import { setEmitter } from '../src/domain/game/emitterRef.js';
import { startGame } from '../src/domain/game/engine.js';

const GAME = 'g-credit';

function seedRoom(opts: { tier: GameTier; hostPlayerId?: string; type?: GameType }) {
  const mk = (id: string, joinOrder: number) => ({
    id,
    nickname: id,
    avatarId: 'falcon',
    status: 'ACTIVE',
    score: 0,
    lives: 3,
    joinOrder,
    correctCount: 0,
    speedMs: 0,
    sessionTokenHash: `h-${id}`,
  });
  h.store.set(GAME, {
    gameId: GAME,
    roomCode: 'ABC123',
    type: opts.type ?? GameType.INDIVIDUAL,
    mode: GameMode.POINTS,
    status: 'LOBBY',
    settings: {
      ...DEFAULT_GAME_SETTINGS,
      type: opts.type ?? GameType.INDIVIDUAL,
      mode: GameMode.POINTS,
      tier: opts.tier,
      perPlayerCategory: false,
    },
    hostTokenHash: 'host',
    packageId: 'pkg',
    hostPlayerId: opts.hostPlayerId,
    questionOrder: ['q1', 'q2'],
    roundIndex: -1,
    totalRounds: 2,
    participants: { p1: mk('p1', 0), p2: mk('p2', 1) },
    teams: {},
    currentRound: null,
    createdAt: 0,
  });
}

/** startGame ends by starting round 1, which our stubbed loader rejects. The
 *  billing decision has already been made by then, so swallow that. */
const start = () => startGame(GAME).catch((e: Error) => e);

describe('paid game-credit is charged at start, not at room creation', () => {
  beforeEach(() => {
    h.store.clear();
    h.charged.clear();
    h.calls.consume = 0;
    h.setWallet(1);
    setEmitter({ toRoom: () => {}, toSocket: () => {} });
  });

  it('spends exactly one credit when a PAID game starts', async () => {
    seedRoom({ tier: GameTier.PAID, hostPlayerId: 'host-1' });
    await start();
    expect(h.calls.consume).toBe(1);
    expect(h.wallet()).toBe(0);
    expect(h.charged.get(GAME)).toBeInstanceOf(Date);
  });

  it('never charges twice for the same game (a retried start is free)', async () => {
    seedRoom({ tier: GameTier.PAID, hostPlayerId: 'host-1' });
    h.setWallet(2);
    await start();
    // Re-open the same room in LOBBY (as a resumed/retried start would) and start again.
    h.store.get(GAME).status = 'LOBBY';
    await start();
    expect(h.calls.consume).toBe(1);
    expect(h.wallet()).toBe(1);
  });

  it('spends a credit for a PAID TEAMS game too (every format costs one)', async () => {
    // Teams used to slip past the individual-only check and got the full bank for
    // free — «تُستخدم اللعبة الواحدة لبدء مباراة كاملة بالنظام الذي تختاره».
    seedRoom({ tier: GameTier.PAID, hostPlayerId: 'host-1', type: GameType.TEAMS });
    await start();
    expect(h.calls.consume).toBe(1);
    expect(h.wallet()).toBe(0);
  });

  it('charges nothing for a FREE TEAMS game', async () => {
    seedRoom({ tier: GameTier.FREE, hostPlayerId: 'host-1', type: GameType.TEAMS });
    await start();
    expect(h.calls.consume).toBe(0);
    expect(h.wallet()).toBe(1);
  });

  it('charges nothing for a FREE game', async () => {
    seedRoom({ tier: GameTier.FREE, hostPlayerId: 'host-1' });
    await start();
    expect(h.calls.consume).toBe(0);
    expect(h.wallet()).toBe(1);
  });

  it('charges nothing for a guest host with no account', async () => {
    seedRoom({ tier: GameTier.PAID });
    await start();
    expect(h.calls.consume).toBe(0);
  });

  it('refuses to start (and leaves the game unstamped) when the wallet is empty', async () => {
    seedRoom({ tier: GameTier.PAID, hostPlayerId: 'host-1' });
    h.setWallet(0);
    const err = await start();
    expect((err as Error).message).toContain('رصيد');
    expect(h.charged.get(GAME)).toBeNull();
    // Still in LOBBY — the game never went ACTIVE.
    expect(h.store.get(GAME).status).toBe('LOBBY');
  });
});
