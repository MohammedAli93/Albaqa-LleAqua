import { describe, it, expect } from 'vitest';
import { GameType, GameMode, ParticipantStatus, ScoringMode } from '@tahaddi/shared';
import {
  computePoints,
  scoreRound,
  applyResolution,
  evaluateWinCondition,
  activeParticipants,
  topContenders,
  decideTiebreak,
} from '../src/domain/game/scoring.js';
import type { LiveTeam } from '../src/domain/rooms/types.js';
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
    expect(computePoints(100, true, 7500, 15000)).toBe(125);
  });
});

describe('scoreRound — individual', () => {
  it('marks correct, incorrect and timeout answers (speed scoring)', () => {
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
    const state = makeRoom(
      [p1, p2, p3],
      { mode: GameMode.POINTS, currentRound: round },
      { scoringMode: ScoringMode.SPEED },
    );

    const { outcomes } = scoreRound(state, round);
    const byId = Object.fromEntries(outcomes.map((o) => [o.participantId, o]));

    expect(byId.p1!.isCorrect).toBe(true);
    expect(byId.p1!.pointsAwarded).toBe(100); // speedBonus off in fixture
    expect(byId.p2!.isCorrect).toBe(false);
    expect(byId.p2!.pointsAwarded).toBe(0);
    expect(byId.p3!.isCorrect).toBe(false);
    expect(byId.p3!.responseMs).toBe(15000); // full window for a timeout
  });

  it('elimination mode awards no points (survival only)', () => {
    const p1 = makeParticipant('p1');
    const round = makeRound({ answers: { p1: { optionId: 'a', serverTs: 1_002_000 } } });
    const state = makeRoom([p1], { mode: GameMode.ELIMINATION, currentRound: round });
    const { outcomes } = scoreRound(state, round);
    expect(outcomes[0]!.isCorrect).toBe(true);
    expect(outcomes[0]!.pointsAwarded).toBe(0); // no scoring in elimination
  });

  it('placement (points mode): ranks correct answers 3 / 2 / 1', () => {
    const p1 = makeParticipant('p1');
    const p2 = makeParticipant('p2');
    const p3 = makeParticipant('p3');
    const round = makeRound({
      answers: {
        p2: { optionId: 'a', serverTs: 1_001_000 }, // 1st
        p1: { optionId: 'a', serverTs: 1_002_000 }, // 2nd
        p3: { optionId: 'a', serverTs: 1_003_000 }, // 3rd
      },
    });
    const state = makeRoom([p1, p2, p3], { mode: GameMode.POINTS, currentRound: round });
    const { outcomes } = scoreRound(state, round);
    const byId = Object.fromEntries(outcomes.map((o) => [o.participantId, o]));
    expect(byId.p2!.pointsAwarded).toBe(3);
    expect(byId.p1!.pointsAwarded).toBe(2);
    expect(byId.p3!.pointsAwarded).toBe(1);
  });
});

describe('applyResolution — individual elimination', () => {
  it('eliminates a player who runs out of lives', () => {
    const p1 = makeParticipant('p1', { lives: 1 });
    const p2 = makeParticipant('p2', { lives: 1 });
    const round = makeRound({ answers: { p1: { optionId: 'a', serverTs: 1_001_000 } } });
    const state = makeRoom([p1, p2], { mode: GameMode.ELIMINATION, currentRound: round });

    const scored = scoreRound(state, round);
    const { eliminatedIds } = applyResolution(state, round, scored);

    expect(state.participants.p1!.status).toBe(ParticipantStatus.ACTIVE);
    expect(state.participants.p2!.status).toBe(ParticipantStatus.ELIMINATED);
    expect(eliminatedIds).toEqual(['p2']);
  });

  it('decrements exactly one life per wrong answer', () => {
    const p1 = makeParticipant('p1', { lives: 2 });
    const round = makeRound({ answers: {} }); // p1 times out → wrong
    const state = makeRoom([p1], { mode: GameMode.ELIMINATION, currentRound: round });
    const scored = scoreRound(state, round);
    const { eliminatedIds } = applyResolution(state, round, scored);
    expect(state.participants.p1!.lives).toBe(1);
    expect(eliminatedIds).toHaveLength(0);
  });

  it('points mode never eliminates', () => {
    const p1 = makeParticipant('p1', { lives: 1 });
    const round = makeRound({ answers: {} }); // wrong/timeout
    const state = makeRoom([p1], { mode: GameMode.POINTS, currentRound: round });
    const scored = scoreRound(state, round);
    const { eliminatedIds } = applyResolution(state, round, scored);
    expect(state.participants.p1!.status).toBe(ParticipantStatus.ACTIVE);
    expect(eliminatedIds).toHaveLength(0);
  });
});

describe('scoreRound — teams (first correct earns the point)', () => {
  function teamRoom() {
    // Team A: a1, a2 — Team B: b1
    const a1 = makeParticipant('a1', { teamId: 'A', joinOrder: 0 });
    const a2 = makeParticipant('a2', { teamId: 'A', joinOrder: 1 });
    const b1 = makeParticipant('b1', { teamId: 'B', joinOrder: 2 });
    const teamA: LiveTeam = { id: 'A', name: 'A', color: '#1', score: 0, winMs: 0, lives: 1, capacity: 4 };
    const teamB: LiveTeam = { id: 'B', name: 'B', color: '#2', score: 0, winMs: 0, lives: 1, capacity: 4 };
    return { a1, a2, b1, teams: { A: teamA, B: teamB } };
  }

  it('awards the team point to the first correct member only', () => {
    const { a1, a2, b1, teams } = teamRoom();
    const round = makeRound({
      answers: {
        a2: { optionId: 'a', serverTs: 1_004_000 }, // correct, slower
        a1: { optionId: 'a', serverTs: 1_002_000 }, // correct, FIRST for team A
        b1: { optionId: 'a', serverTs: 1_003_000 }, // correct, team B
      },
    });
    const state = makeRoom([a1, a2, b1], {
      type: GameType.TEAMS,
      mode: GameMode.POINTS,
      teams,
      currentRound: round,
    });

    const scored = scoreRound(state, round);
    const byId = Object.fromEntries(scored.outcomes.map((o) => [o.participantId, o]));

    // Race: a1 was the globally-first correct (1_002_000) → ONLY team A wins.
    // b1 (1_003_000) and a2 (1_004_000) earn nothing — no per-round tie.
    expect(byId.a1!.isTeamHero).toBe(true);
    expect(byId.a2!.pointsAwarded).toBe(0);
    expect(byId.a2!.isTeamHero).toBeUndefined();
    expect(byId.b1!.isTeamHero).toBeUndefined();
    expect(scored.heroes.map((h) => h.teamId)).toEqual(['A']);
    expect(scored.heroes[0]!.participantId).toBe('a1');

    applyResolution(state, round, scored);
    // Only one team wins the round (+1). The losing team gets nothing.
    expect(state.teams.A!.score).toBe(1);
    expect(state.teams.B!.score).toBe(0);
    // No per-player scoreboard in team mode — players carry no points.
    expect(state.participants.a1!.score).toBe(0);
  });

  it('accumulates one team point per round won (not per player)', () => {
    const { a1, a2, b1, teams } = teamRoom();
    const state = makeRoom([a1, a2, b1], { type: GameType.TEAMS, mode: GameMode.POINTS, teams });
    // Round 1: both A members correct (A first), B wrong → only A scores.
    const r1 = makeRound({ answers: { a1: { optionId: 'a', serverTs: 1_002_000 }, a2: { optionId: 'a', serverTs: 1_003_000 }, b1: { optionId: 'b', serverTs: 1_001_000 } } });
    applyResolution(state, r1, scoreRound({ ...state, currentRound: r1 }, r1));
    // Round 2: A correct again.
    const r2 = makeRound({ answers: { a1: { optionId: 'a', serverTs: 1_002_000 } } });
    applyResolution(state, r2, scoreRound({ ...state, currentRound: r2 }, r2));
    expect(state.teams.A!.score).toBe(2); // two rounds won = 2 points (not 2× members)
    expect(state.teams.B!.score).toBe(0);
  });

  it('breaks an equal-score finish in favour of the faster team (lower buzz time)', () => {
    const { a1, b1, teams } = teamRoom();
    const state = makeRoom([a1, b1], { type: GameType.TEAMS, mode: GameMode.POINTS, teams });
    // Round 1: team A wins, but SLOWLY (responseMs 5000).
    const r1 = makeRound({ answers: { a1: { optionId: 'a', serverTs: 1_005_000 } } });
    applyResolution(state, r1, scoreRound({ ...state, currentRound: r1 }, r1));
    // Round 2: team B wins, FAST (responseMs 2000).
    const r2 = makeRound({ answers: { b1: { optionId: 'a', serverTs: 1_002_000 } } });
    applyResolution(state, r2, scoreRound({ ...state, currentRound: r2 }, r2));

    // Both teams won one round → tied on points, but B was faster overall.
    expect(state.teams.A!.score).toBe(1);
    expect(state.teams.B!.score).toBe(1);
    expect(state.teams.A!.winMs).toBe(5000);
    expect(state.teams.B!.winMs).toBe(2000);

    const win = evaluateWinCondition(state, true);
    expect(win.isOver).toBe(true);
    expect(win.winnerTeamId).toBe('B'); // faster team wins the tie
  });

  it('team mode is points-only: no team ever loses a life or gets eliminated', () => {
    const { a1, a2, b1, teams } = teamRoom();
    teams.A.lives = 2;
    teams.B.lives = 2;
    const round = makeRound({
      answers: {
        a1: { optionId: 'a', serverTs: 1_002_000 }, // team A correct
        b1: { optionId: 'b', serverTs: 1_003_000 }, // team B wrong
      },
    });
    const state = makeRoom(
      [a1, a2, b1],
      { type: GameType.TEAMS, mode: GameMode.POINTS, teams, currentRound: round },
      { scoringMode: ScoringMode.PLACEMENT },
    );
    const scored = scoreRound(state, round);
    const { eliminatedIds } = applyResolution(state, round, scored);
    // Lives are untouched and nobody is eliminated — teams just accumulate points.
    expect(state.teams.A!.lives).toBe(2);
    expect(state.teams.B!.lives).toBe(2);
    expect(eliminatedIds).toHaveLength(0);
    expect([a1, a2, b1].every((p) => state.participants[p.id]!.status === 'ACTIVE')).toBe(true);
  });
});

describe('evaluateWinCondition', () => {
  it('elimination: declares a winner when one player remains', () => {
    const p1 = makeParticipant('p1', { status: ParticipantStatus.ACTIVE, score: 200 });
    const p2 = makeParticipant('p2', { status: ParticipantStatus.ELIMINATED });
    const state = makeRoom([p1, p2], { mode: GameMode.ELIMINATION });
    const win = evaluateWinCondition(state, false);
    expect(win.isOver).toBe(true);
    expect(win.winnerId).toBe('p1');
  });

  it('elimination: not over while multiple players remain and questions are left', () => {
    const state = makeRoom([makeParticipant('p1'), makeParticipant('p2')], {
      mode: GameMode.ELIMINATION,
    });
    expect(evaluateWinCondition(state, false).isOver).toBe(false);
  });

  it('elimination: on exhaustion the winner is the survivor with most lives (not score)', () => {
    const p1 = makeParticipant('p1', { lives: 1, score: 10 });
    const p2 = makeParticipant('p2', { lives: 3, score: 0 }); // fewer points, more lives → wins
    const state = makeRoom([p1, p2], { mode: GameMode.ELIMINATION });
    const win = evaluateWinCondition(state, true);
    expect(win.isOver).toBe(true);
    expect(win.winnerId).toBe('p2');
  });

  it('points: only ends on question exhaustion, highest score wins', () => {
    const p1 = makeParticipant('p1', { score: 100 });
    const p2 = makeParticipant('p2', { score: 300 });
    const state = makeRoom([p1, p2], { mode: GameMode.POINTS });
    expect(evaluateWinCondition(state, false).isOver).toBe(false);
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

describe('topContenders — tie detection', () => {
  it('individual points: unique top → no tie', () => {
    const state = makeRoom([
      makeParticipant('p1', { score: 5 }),
      makeParticipant('p2', { score: 3 }),
    ]);
    const c = topContenders(state);
    expect(c.unique).toBe(true);
    expect(c.winnerId).toBe('p1');
  });

  it('individual points: equal top score → sudden-death contenders', () => {
    const state = makeRoom([
      makeParticipant('p1', { score: 3 }),
      makeParticipant('p2', { score: 3 }),
      makeParticipant('p3', { score: 1 }),
    ]);
    const c = topContenders(state);
    expect(c.unique).toBe(false);
    expect(c.contenders.sort()).toEqual(['p1', 'p2']);
    expect(c.isTeam).toBe(false);
  });

  it('teams: equal team score → team contenders', () => {
    const teams: Record<string, LiveTeam> = {
      t1: { id: 't1', name: 'A', color: '#f00', score: 4, winMs: 0, lives: 0, capacity: null },
      t2: { id: 't2', name: 'B', color: '#00f', score: 4, winMs: 0, lives: 0, capacity: null },
    };
    const state = makeRoom([], { type: GameType.TEAMS, teams });
    const c = topContenders(state);
    expect(c.unique).toBe(false);
    expect(c.isTeam).toBe(true);
    expect(c.contenders.sort()).toEqual(['t1', 't2']);
  });
});

describe('decideTiebreak — fastest correct wins', () => {
  const correctId = 'a';
  it('unique fastest correct contender wins', () => {
    const state = makeRoom([makeParticipant('p1'), makeParticipant('p2')], {
      tiebreak: { contenders: ['p1', 'p2'], isTeam: false },
    });
    const round = makeRound({
      startedAt: 1_000_000,
      correctOptionId: correctId,
      answers: {
        p1: { optionId: 'a', serverTs: 1_002_000 }, // correct, 2s
        p2: { optionId: 'a', serverTs: 1_004_000 }, // correct, 4s
      },
    });
    const d = decideTiebreak(state, round);
    expect(d.decided).toBe(true);
    expect(d.winnerId).toBe('p1');
  });

  it('nobody correct → replay with same contenders', () => {
    const state = makeRoom([makeParticipant('p1'), makeParticipant('p2')], {
      tiebreak: { contenders: ['p1', 'p2'], isTeam: false },
    });
    const round = makeRound({
      startedAt: 1_000_000,
      correctOptionId: correctId,
      answers: {
        p1: { optionId: 'b', serverTs: 1_002_000 },
        p2: { optionId: 'c', serverTs: 1_003_000 },
      },
    });
    const d = decideTiebreak(state, round);
    expect(d.decided).toBe(false);
    expect(d.contenders.sort()).toEqual(['p1', 'p2']);
  });

  it('only one contender answered correctly → they win', () => {
    const state = makeRoom([makeParticipant('p1'), makeParticipant('p2')], {
      tiebreak: { contenders: ['p1', 'p2'], isTeam: false },
    });
    const round = makeRound({
      startedAt: 1_000_000,
      correctOptionId: correctId,
      answers: {
        p1: { optionId: 'b', serverTs: 1_002_000 }, // wrong
        p2: { optionId: 'a', serverTs: 1_005_000 }, // correct
      },
    });
    const d = decideTiebreak(state, round);
    expect(d.decided).toBe(true);
    expect(d.winnerId).toBe('p2');
  });
});
