/**
 * Pure scoring & elimination logic. No I/O — given inputs, returns results.
 * This is the fairness core; it is unit-tested in isolation.
 *
 * Two orthogonal axes drive everything:
 *  - type:  INDIVIDUAL (each player scores) | TEAMS (the team scores)
 *  - mode:  POINTS (placement, no elimination) | ELIMINATION (lives, last standing)
 *
 * TEAMS rule (client requirement): all players in a team may attempt; only the
 * FIRST to answer correctly (by SERVER timestamp) earns the team's point — never
 * double-scored. That "hero" is surfaced so clients can show who earned it.
 */
import {
  GameType,
  GameMode,
  ParticipantStatus,
  ScoringMode,
  PLACEMENT_POINTS,
  defaultScoringMode,
} from '@tahaddi/shared';
import type { LiveParticipant, LiveRound, LiveTeam, RoomState } from '../rooms/types.js';

export interface AnswerOutcome {
  participantId: string;
  selectedOptionId: string | null;
  isCorrect: boolean;
  responseMs: number;
  pointsAwarded: number;
  /** TEAMS mode: true if this player earned the point for their team this round. */
  isTeamHero?: boolean;
}

/** The first-correct earner for a team in a round (TEAMS mode). */
export interface TeamHero {
  teamId: string;
  participantId: string;
  pointsAwarded: number;
}

export interface ScoredRound {
  outcomes: AnswerOutcome[];
  /** TEAMS mode only — one entry per team that answered correctly. */
  heroes: TeamHero[];
}

/**
 * Speed-bonus curve: a correct answer earns basePoints plus up to 50% extra,
 * scaled linearly by how much of the window remained when it arrived. Uses
 * SERVER-measured response time only (anti-cheat — never client timestamps).
 */
export function computePoints(
  basePoints: number,
  speedBonus: boolean,
  responseMs: number,
  windowMs: number,
): number {
  if (!speedBonus || windowMs <= 0) return basePoints;
  const remaining = Math.max(0, Math.min(1, 1 - responseMs / windowMs));
  return Math.round(basePoints * (1 + 0.5 * remaining));
}

/** Placement points: rank correct answers by response time → 3 / 2 / 1. */
function placementPoints(rankZeroBased: number): number {
  return rankZeroBased === 0
    ? PLACEMENT_POINTS.FIRST
    : rankZeroBased === 1
      ? PLACEMENT_POINTS.SECOND
      : PLACEMENT_POINTS.REST;
}

function effectiveScoringMode(state: RoomState): ScoringMode {
  return state.settings.scoringMode ?? defaultScoringMode(state.mode);
}

/** Build raw outcomes (correctness + server response time) for active players. */
function baseOutcomes(state: RoomState, round: LiveRound): AnswerOutcome[] {
  const windowMs = round.timeLimitSec * 1000;
  const outcomes: AnswerOutcome[] = [];
  for (const p of Object.values(state.participants)) {
    if (p.status !== ParticipantStatus.ACTIVE) continue;
    const submitted = round.answers[p.id];
    const isCorrect = !!submitted && submitted.optionId === round.correctOptionId;
    const responseMs = submitted ? Math.max(0, submitted.serverTs - round.startedAt) : windowMs;
    outcomes.push({
      participantId: p.id,
      selectedOptionId: submitted?.optionId ?? null,
      isCorrect,
      responseMs,
      pointsAwarded: 0,
    });
  }
  return outcomes;
}

/** INDIVIDUAL scoring: per-player speed bonus, or placement rank across all correct. */
function scoreIndividual(state: RoomState, round: LiveRound, outcomes: AnswerOutcome[]): void {
  if (effectiveScoringMode(state) === ScoringMode.PLACEMENT) {
    const correct = outcomes.filter((o) => o.isCorrect).sort((a, b) => a.responseMs - b.responseMs);
    correct.forEach((o, i) => {
      o.pointsAwarded = placementPoints(i);
    });
    return;
  }
  const windowMs = round.timeLimitSec * 1000;
  for (const o of outcomes) {
    if (o.isCorrect) {
      o.pointsAwarded = computePoints(round.basePoints, round.speedBonus, o.responseMs, windowMs);
    }
  }
}

/**
 * TEAMS scoring (client rule): the score belongs to the TEAM, not the player.
 * For each team, the FIRST correct member (by server time) is the hero and earns
 * the team a FLAT +1 — never placement/speed, never per-player accumulation.
 * Both teams can earn +1 in the same round (each team's own first-correct).
 */
function scoreTeams(state: RoomState, outcomes: AnswerOutcome[]): TeamHero[] {
  const byParticipant = new Map(outcomes.map((o) => [o.participantId, o]));

  // First correct outcome per team.
  const heroOutcomeByTeam = new Map<string, AnswerOutcome>();
  for (const o of outcomes) {
    if (!o.isCorrect) continue;
    const teamId = state.participants[o.participantId]?.teamId;
    if (!teamId) continue;
    const current = heroOutcomeByTeam.get(teamId);
    if (!current || o.responseMs < current.responseMs) heroOutcomeByTeam.set(teamId, o);
  }

  const heroes: TeamHero[] = [];
  for (const [teamId, heroOutcome] of heroOutcomeByTeam) {
    const o = byParticipant.get(heroOutcome.participantId)!;
    o.pointsAwarded = 1; // flat — display only; the +1 is applied to the TEAM total
    o.isTeamHero = true;
    heroes.push({ teamId, participantId: heroOutcome.participantId, pointsAwarded: 1 });
  }
  return heroes;
}

/** Resolve a round: correctness, response times, and points per type/mode. */
export function scoreRound(state: RoomState, round: LiveRound): ScoredRound {
  const outcomes = baseOutcomes(state, round);
  if (state.type === GameType.TEAMS) {
    return { outcomes, heroes: scoreTeams(state, outcomes) };
  }
  // INDIVIDUAL: points are a POINTS-mode concept only. Elimination is survival-only
  // (no score is awarded or shown — ranking is by lives / elimination order).
  if (state.mode === GameMode.POINTS) scoreIndividual(state, round, outcomes);
  return { outcomes, heroes: [] };
}

export interface ResolutionResult {
  eliminatedIds: string[];
}

/**
 * Apply a scored round to state (scores, lives, eliminations) per type/mode.
 * Mutates participants/teams in `state`. Returns who was eliminated this round.
 */
export function applyResolution(
  state: RoomState,
  round: LiveRound,
  scored: ScoredRound,
): ResolutionResult {
  // TEAMS: the score is TEAM-owned. Each team that answered first-correct gets a
  // flat +1 added straight to the team total — no per-player scoreboard exists.
  if (state.type === GameType.TEAMS) {
    for (const hero of scored.heroes) {
      const team = state.teams[hero.teamId];
      if (team) team.score += 1;
    }
    return { eliminatedIds: [] };
  }

  // INDIVIDUAL: award personal points (POINTS mode only; elimination awards none).
  for (const o of scored.outcomes) {
    const p = state.participants[o.participantId];
    if (p) p.score += o.pointsAwarded;
  }

  const eliminatedIds: string[] = [];
  if (state.mode === GameMode.ELIMINATION) {
    // A wrong (or missing) answer costs a life; 0 lives → eliminated this round.
    for (const o of scored.outcomes) {
      const p = state.participants[o.participantId];
      if (!p || o.isCorrect) continue;
      p.lives = Math.max(0, p.lives - 1);
      if (p.lives <= 0) {
        p.status = ParticipantStatus.ELIMINATED;
        p.eliminatedRound = round.index;
        eliminatedIds.push(p.id);
      }
    }
  }
  return { eliminatedIds };
}

/** Players still in the running. */
export function activeParticipants(state: RoomState): LiveParticipant[] {
  return Object.values(state.participants).filter(
    (p) => p.status === ParticipantStatus.ACTIVE,
  );
}

export interface WinCondition {
  isOver: boolean;
  /** Single winner (INDIVIDUAL) if decided. */
  winnerId?: string;
  /** Winning team id (TEAMS) if decided. */
  winnerTeamId?: string;
}

/**
 * Survival ranking comparator for ELIMINATION mode (sort ascending → best first).
 * Order: still-alive before eliminated → more lives first → eliminated later
 * (higher eliminatedRound) ranks above those out earlier → earliest joinOrder.
 * Score is intentionally NOT used — elimination is purely about survival.
 */
export function compareSurvival(a: LiveParticipant, b: LiveParticipant): number {
  const aAlive = a.status !== ParticipantStatus.ELIMINATED;
  const bAlive = b.status !== ParticipantStatus.ELIMINATED;
  if (aAlive !== bAlive) return aAlive ? -1 : 1;
  if (a.lives !== b.lives) return b.lives - a.lives;
  const ar = a.eliminatedRound ?? Number.POSITIVE_INFINITY;
  const br = b.eliminatedRound ?? Number.POSITIVE_INFINITY;
  if (ar !== br) return br - ar; // eliminated later → better rank
  return a.joinOrder - b.joinOrder;
}

/**
 * Determine whether the game is over and who won.
 *  - POINTS: never eliminates — ends when the rounds run out; highest total wins.
 *  - ELIMINATION (INDIVIDUAL only): ends at ≤1 active player, or when rounds run out;
 *    the winner is the last survivor (survival ranking, NOT score).
 *  - TEAMS: always points-based — ends when rounds run out; highest team score wins.
 */
export function evaluateWinCondition(state: RoomState, questionsExhausted: boolean): WinCondition {
  if (state.type === GameType.TEAMS) {
    if (!questionsExhausted) return { isOver: false };
    return { isOver: true, winnerTeamId: pickTopTeam(Object.values(state.teams))?.id };
  }

  // INDIVIDUAL
  if (state.mode === GameMode.POINTS) {
    if (!questionsExhausted) return { isOver: false };
    return { isOver: true, winnerId: pickTopParticipant(Object.values(state.participants))?.id };
  }

  const active = activeParticipants(state);
  if (active.length <= 1 || questionsExhausted) {
    const winner = [...Object.values(state.participants)].sort(compareSurvival)[0];
    return { isOver: true, winnerId: winner?.id };
  }
  return { isOver: false };
}

function pickTopParticipant(list: LiveParticipant[]): LiveParticipant | undefined {
  return [...list].sort((a, b) => b.score - a.score || a.joinOrder - b.joinOrder)[0];
}

function pickTopTeam(list: LiveTeam[]): LiveTeam | undefined {
  return [...list].sort((a, b) => b.score - a.score)[0];
}
