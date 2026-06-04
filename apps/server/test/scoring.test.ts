import { describe, it, expect } from 'vitest';
import { GameMode, ParticipantStatus } from '@tahaddi/shared';
import {
  computePoints,
  resolveAnswers,
  applyResolution,
  evaluateWinCondition,
  activeParticipants,
} from '../src/domain/game/scoring.js';
import { makeParticipant, makeRound, makeRoom } from './fixtures.js';

describe('computePoints', () => {
  it('returns base points when speed bonus is off', () => {
    expect(computePoints(100, false, 5000, 15000)).toBe(100);
  });
  it('awards up to +50% for an instant correct answer', () => {
    expect(computePoints(100, true, 0, 15000)).toBe(150);
  });
  it('awards base points for an answer at the buzzer', () => {
    expect(computePoints(100, true, 15000, 15000)).toBe(100);
  });
  it('scales linearly with remaining time', () => {
    // halfway through the window → +25%
    expect(computePoints(100, true, 7500, 15000)).toBe(125);
  });
});

describe('resolveAnswers', () => {
  it('marks correct, incorrect and timeout answers', () => {
    const p1 = makeParticipant('p1');
    const p2 = makeParticipant('p2');
    const p3 = makeParticipant('p3'); // no answer → timeout
    const round = makeRound({
      startedAt: 1_000_000,
      endsAt: 1_015_000,
      answers: {
        p1: { optionId: 'a', serverTs: 1_002_000 }, // correct
        p2: { optionId: 'b', serverTs: 1_003_000 }, // wrong
      },
    });
    const state = makeRoom([p1, p2, p3], { currentRound: round });

    const outcomes = resolveAnswers(state, round);
    const byId = Object.fromEntries(outcomes.map((o) => [o.participantId, o]));

    expect(byId.p1!.isCorrect).toBe(true);
    expect(byId.p1!.pointsAwarded).toBe(100); // speedBonus off in fixture
    expect(byId.p2!.isCorrect).toBe(false);
    expect(byId.p2!.pointsAwarded).toBe(0);
    expect(byId.p3!.isCorrect).toBe(false);
    expect(byId.p3!.responseMs).toBe(15000); // full window for a timeout
  });
});

describe('applyResolution — individual mode', () => {
  it('eliminates a player who runs out of lives', () => {
    const p1 = makeParticipant('p1', { lives: 1 });
    const p2 = makeParticipant('p2', { lives: 1 });
    const round = makeRound({ answers: { p1: { optionId: 'a', serverTs: 1_001_000 } } });
    const state = makeRoom([p1, p2], { currentRound: round });

    const outcomes = resolveAnswers(state, round);
    const { eliminatedIds } = applyResolution(state, round, outcomes);

    expect(state.participants.p1!.status).toBe(ParticipantStatus.ACTIVE);
    expect(state.participants.p2!.status).toBe(ParticipantStatus.ELIMINATED);
    expect(eliminatedIds).toEqual(['p2']);
  });

  it('only decrements a life when multiple lives are configured', () => {
    const p1 = makeParticipant('p1', { lives: 2 });
    const round = makeRound({ answers: {} }); // p1 times out → wrong
    const state = makeRoom([p1], { currentRound: round });
    const outcomes = resolveAnswers(state, round);
    const { eliminatedIds } = applyResolution(state, round, outcomes);
    expect(state.participants.p1!.lives).toBe(1);
    expect(eliminatedIds).toHaveLength(0);
  });
});

describe('applyResolution — sudden death', () => {
  it('eliminates on a single wrong answer regardless of lives', () => {
    const p1 = makeParticipant('p1', { lives: 3 });
    const round = makeRound({ answers: { p1: { optionId: 'b', serverTs: 1_001_000 } } });
    const state = makeRoom([p1], { currentRound: round }, {});
    state.mode = GameMode.SUDDEN_DEATH;
    const outcomes = resolveAnswers(state, round);
    const { eliminatedIds } = applyResolution(state, round, outcomes);
    expect(state.participants.p1!.status).toBe(ParticipantStatus.ELIMINATED);
    expect(eliminatedIds).toEqual(['p1']);
  });
});

describe('evaluateWinCondition', () => {
  it('declares a winner when one player remains', () => {
    const p1 = makeParticipant('p1', { status: ParticipantStatus.ACTIVE, score: 200 });
    const p2 = makeParticipant('p2', { status: ParticipantStatus.ELIMINATED });
    const state = makeRoom([p1, p2]);
    const win = evaluateWinCondition(state, false);
    expect(win.isOver).toBe(true);
    expect(win.winnerId).toBe('p1');
  });

  it('is not over while multiple players remain and questions are left', () => {
    const state = makeRoom([makeParticipant('p1'), makeParticipant('p2')]);
    expect(evaluateWinCondition(state, false).isOver).toBe(false);
  });

  it('on question exhaustion, the highest score wins', () => {
    const p1 = makeParticipant('p1', { score: 100 });
    const p2 = makeParticipant('p2', { score: 300 });
    const state = makeRoom([p1, p2]);
    const win = evaluateWinCondition(state, true);
    expect(win.isOver).toBe(true);
    expect(win.winnerId).toBe('p2');
  });
});

describe('activeParticipants', () => {
  it('counts only ACTIVE players', () => {
    const state = makeRoom([
      makeParticipant('p1'),
      makeParticipant('p2', { status: ParticipantStatus.ELIMINATED }),
      makeParticipant('p3', { status: ParticipantStatus.DISCONNECTED }),
    ]);
    expect(activeParticipants(state)).toHaveLength(1);
  });
});
