import { describe, it, expect } from 'vitest';
import { GameMode, ScoringMode, ParticipantStatus } from '@tahaddi/shared';
import {
  resolveAnswers,
  applyPlacementPoints,
  applyResolution,
  evaluateWinCondition,
} from '../src/domain/game/scoring.js';
import { makeParticipant, makeRound, makeRoom } from './fixtures.js';

const START = 1_000_000;

describe('League placement scoring (الدوري)', () => {
  it('awards 3 / 2 / 1 to correct answers by server time, 0 to wrong', () => {
    const ps = ['p1', 'p2', 'p3', 'p4', 'p5'].map((id) => makeParticipant(id));
    const round = makeRound({
      startedAt: START,
      endsAt: START + 15_000,
      answers: {
        p3: { optionId: 'a', serverTs: START + 3000 }, // 3rd correct → 1
        p1: { optionId: 'a', serverTs: START + 1000 }, // 1st correct → 3
        p2: { optionId: 'a', serverTs: START + 2000 }, // 2nd correct → 2
        p4: { optionId: 'b', serverTs: START + 500 }, // wrong → 0
        // p5 never answers → 0
      },
    });
    const state = makeRoom(ps, { currentRound: round, mode: GameMode.LEAGUE }, {
      scoringMode: ScoringMode.PLACEMENT,
    });

    const outcomes = resolveAnswers(state, round);
    const pts = Object.fromEntries(outcomes.map((o) => [o.participantId, o.pointsAwarded]));
    expect(pts).toEqual({ p1: 3, p2: 2, p3: 1, p4: 0, p5: 0 });
  });

  it('gives every correct answer beyond 2nd exactly 1 point', () => {
    const outcomes = [
      { participantId: 'a', selectedOptionId: 'a', isCorrect: true, responseMs: 100, pointsAwarded: 0 },
      { participantId: 'b', selectedOptionId: 'a', isCorrect: true, responseMs: 200, pointsAwarded: 0 },
      { participantId: 'c', selectedOptionId: 'a', isCorrect: true, responseMs: 300, pointsAwarded: 0 },
      { participantId: 'd', selectedOptionId: 'a', isCorrect: true, responseMs: 400, pointsAwarded: 0 },
    ];
    applyPlacementPoints(outcomes);
    expect(outcomes.map((o) => o.pointsAwarded)).toEqual([3, 2, 1, 1]);
  });

  it('never eliminates anyone — a wrong answer just scores 0', () => {
    const p1 = makeParticipant('p1', { lives: 1 });
    const round = makeRound({ answers: { p1: { optionId: 'b', serverTs: START + 1000 } } });
    const state = makeRoom([p1], { currentRound: round, mode: GameMode.LEAGUE }, {
      scoringMode: ScoringMode.PLACEMENT,
    });
    const outcomes = resolveAnswers(state, round);
    const { eliminatedIds } = applyResolution(state, round, outcomes);
    expect(eliminatedIds).toHaveLength(0);
    expect(state.participants.p1!.status).toBe(ParticipantStatus.ACTIVE);
  });

  it('ends only when rounds run out; highest total wins', () => {
    const p1 = makeParticipant('p1', { score: 14 });
    const p2 = makeParticipant('p2', { score: 22 });
    const state = makeRoom([p1, p2], { mode: GameMode.LEAGUE });
    expect(evaluateWinCondition(state, false).isOver).toBe(false); // still playing
    const win = evaluateWinCondition(state, true);
    expect(win).toMatchObject({ isOver: true, winnerId: 'p2' });
  });
});

describe('Cup knockout (الكأس)', () => {
  it('loses a life on a wrong answer and eliminates at zero', () => {
    const p1 = makeParticipant('p1', { lives: 3 });
    const p2 = makeParticipant('p2', { lives: 1 });
    const round = makeRound({
      answers: {
        p1: { optionId: 'b', serverTs: START + 1000 }, // wrong → 3→2
        p2: { optionId: 'b', serverTs: START + 1000 }, // wrong → 1→0 → out
      },
    });
    const state = makeRoom([p1, p2], { currentRound: round, mode: GameMode.CUP });
    const outcomes = resolveAnswers(state, round);
    const { eliminatedIds } = applyResolution(state, round, outcomes);
    expect(state.participants.p1!.lives).toBe(2);
    expect(state.participants.p1!.status).toBe(ParticipantStatus.ACTIVE);
    expect(eliminatedIds).toEqual(['p2']);
  });

  it('declares the last survivor the champion', () => {
    const p1 = makeParticipant('p1', { status: ParticipantStatus.ACTIVE, score: 5 });
    const p2 = makeParticipant('p2', { status: ParticipantStatus.ELIMINATED });
    const state = makeRoom([p1, p2], { mode: GameMode.CUP });
    expect(evaluateWinCondition(state, false)).toMatchObject({ isOver: true, winnerId: 'p1' });
  });
});
