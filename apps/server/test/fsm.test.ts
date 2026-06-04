import { describe, it, expect } from 'vitest';
import { GameStatus, RoundPhase, ParticipantStatus, AppError } from '@tahaddi/shared';
import * as fsm from '../src/domain/game/fsm.js';
import { makeParticipant, makeRound, makeRoom } from './fixtures.js';

describe('status transitions', () => {
  it('allows LOBBY → ACTIVE', () => {
    expect(fsm.canTransition(GameStatus.LOBBY, GameStatus.ACTIVE)).toBe(true);
  });
  it('forbids COMPLETED → ACTIVE', () => {
    expect(fsm.canTransition(GameStatus.COMPLETED, GameStatus.ACTIVE)).toBe(false);
  });
  it('assertTransition throws on illegal moves', () => {
    expect(() => fsm.assertTransition(GameStatus.COMPLETED, GameStatus.ACTIVE)).toThrow(AppError);
  });
});

describe('assertStartable', () => {
  it('rejects starting below minPlayers', () => {
    const state = makeRoom([makeParticipant('p1')], { status: GameStatus.LOBBY }, { minPlayers: 2 });
    expect(() => fsm.assertStartable(state)).toThrow(AppError);
  });
  it('accepts with enough players', () => {
    const state = makeRoom(
      [makeParticipant('p1'), makeParticipant('p2')],
      { status: GameStatus.LOBBY },
      { minPlayers: 2 },
    );
    expect(() => fsm.assertStartable(state)).not.toThrow();
  });
});

describe('assertAnswerable (anti-cheat guards)', () => {
  const base = () =>
    makeRoom([makeParticipant('p1')], {
      currentRound: makeRound({ startedAt: Date.now(), endsAt: Date.now() + 10_000 }),
    });

  it('accepts a valid in-window answer', () => {
    const state = base();
    expect(() => fsm.assertAnswerable(state, 'r1')).not.toThrow();
  });

  it('rejects a stale round id', () => {
    const state = base();
    expect(() => fsm.assertAnswerable(state, 'WRONG')).toThrow(AppError);
  });

  it('rejects answers once the window has closed', () => {
    const state = makeRoom([makeParticipant('p1')], {
      currentRound: makeRound({ startedAt: Date.now() - 20_000, endsAt: Date.now() - 5_000 }),
    });
    expect(() => fsm.assertAnswerable(state, 'r1')).toThrow(AppError);
  });

  it('rejects answers when the round is already LOCKED', () => {
    const state = makeRoom([makeParticipant('p1')], {
      currentRound: makeRound({ phase: RoundPhase.LOCKED, endsAt: Date.now() + 10_000 }),
    });
    expect(() => fsm.assertAnswerable(state, 'r1')).toThrow(AppError);
  });
});

describe('assertJoinable', () => {
  it('rejects joining a game that already started', () => {
    const state = makeRoom([], { status: GameStatus.ACTIVE });
    expect(() => fsm.assertJoinable(state)).toThrow(AppError);
  });
  it('allows joining in the lobby', () => {
    const state = makeRoom([], { status: GameStatus.LOBBY });
    expect(() => fsm.assertJoinable(state)).not.toThrow();
  });
});

// silence unused import lint if ParticipantStatus not referenced elsewhere
void ParticipantStatus;
