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
 * TEAMS scoring: for each team, the FIRST correct member (by server time) is the
 * hero and earns the team's point; every other member earns 0 (no double-score).
 * Teams are then ranked by their hero's response time for placement, or the hero
 * gets a speed bonus in ELIMINATION mode.
 */
function scoreTeams(state: RoomState, round: LiveRound, outcomes: AnswerOutcome[]): TeamHero[] {
  const byParticipant = new Map(outcomes.map((o) => [o.participantId, o]));

  // First correct outcome per team.
  const heroOutcomeByTeam = new Map<string, AnswerOutcome>();
  for (const o of outcomes) {
    if (!o.isCorrect) continue;
    const p = state.participants[o.participantId];
    const teamId = p?.teamId;
    if (!teamId) continue;
    const current = heroOutcomeByTeam.get(teamId);
    if (!current || o.responseMs < current.responseMs) heroOutcomeByTeam.set(teamId, o);
  }

  const placement = effectiveScoringMode(state) === ScoringMode.PLACEMENT;
  const windowMs = round.timeLimitSec * 1000;

  // Rank the teams' heroes by speed for placement scoring.
  const ranked = [...heroOutcomeByTeam.entries()].sort(
    (a, b) => a[1].responseMs - b[1].responseMs,
  );

  const heroes: TeamHero[] = [];
  ranked.forEach(([teamId, heroOutcome], rank) => {
    const points = placement
      ? placementPoints(rank)
      : computePoints(round.basePoints, round.speedBonus, heroOutcome.responseMs, windowMs);
    const o = byParticipant.get(heroOutcome.participantId)!;
    o.pointsAwarded = points;
    o.isTeamHero = true;
    heroes.push({ teamId, participantId: heroOutcome.participantId, pointsAwarded: points });
  });
  return heroes;
}

/** Resolve a round: correctness, response times, and points per type/mode. */
export function scoreRound(state: RoomState, round: LiveRound): ScoredRound {
  const outcomes = baseOutcomes(state, round);
  if (state.type === GameType.TEAMS) {
    const heroes = scoreTeams(state, round, outcomes);
    return { outcomes, heroes };
  }
  scoreIndividual(state, round, outcomes);
  return { outcomes, heroes: [] };
}

export interface ResolutionResult {
  eliminatedIds: string[];
}

/** Recompute every team's aggregate score from its members' personal scores. */
function recomputeTeamScores(state: RoomState): void {
  for (const team of Object.values(state.teams)) team.score = 0;
  for (const p of Object.values(state.participants)) {
    if (p.teamId && state.teams[p.teamId]) state.teams[p.teamId]!.score += p.score;
  }
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
  const eliminatedIds: string[] = [];
  const elimination = state.mode === GameMode.ELIMINATION;

  // Award personal points (heroes carry the team's point; others earned 0).
  for (const o of scored.outcomes) {
    const p = state.participants[o.participantId];
    if (p) p.score += o.pointsAwarded;
  }

  if (elimination && state.type === GameType.TEAMS) {
    // A team loses a life if NO member answered correctly this round.
    const scoringTeamIds = new Set(scored.heroes.map((h) => h.teamId));
    for (const team of Object.values(state.teams)) {
      if (!teamHasActiveMembers(state, team.id)) continue;
      if (!scoringTeamIds.has(team.id)) {
        team.lives = Math.max(0, team.lives - 1);
        if (team.lives <= 0) eliminatedIds.push(...eliminateTeam(state, team, round.index));
      }
    }
  } else if (elimination) {
    // INDIVIDUAL elimination: a wrong (or missing) answer costs a life.
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

  if (state.type === GameType.TEAMS) recomputeTeamScores(state);
  return { eliminatedIds };
}

function teamHasActiveMembers(state: RoomState, teamId: string): boolean {
  return Object.values(state.participants).some(
    (p) => p.teamId === teamId && p.status === ParticipantStatus.ACTIVE,
  );
}

/** Mark all of a team's active members eliminated; return their ids. */
function eliminateTeam(state: RoomState, team: LiveTeam, roundIndex: number): string[] {
  const ids: string[] = [];
  for (const p of Object.values(state.participants)) {
    if (p.teamId === team.id && p.status === ParticipantStatus.ACTIVE) {
      p.status = ParticipantStatus.ELIMINATED;
      p.eliminatedRound = roundIndex;
      ids.push(p.id);
    }
  }
  return ids;
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
 * Determine whether the game is over and who won.
 *  - POINTS: never eliminates — ends when the rounds run out; highest total wins.
 *  - ELIMINATION (INDIVIDUAL): ends at ≤1 active player, or when rounds run out.
 *  - ELIMINATION (TEAMS): ends at ≤1 team with lives, or when rounds run out.
 *  Ties break by score, then earliest joinOrder / team order.
 */
export function evaluateWinCondition(state: RoomState, questionsExhausted: boolean): WinCondition {
  if (state.type === GameType.TEAMS) {
    const teams = Object.values(state.teams);
    if (state.mode === GameMode.ELIMINATION) {
      const alive = teams.filter((t) => t.lives > 0);
      if (alive.length <= 1 || questionsExhausted) {
        return { isOver: true, winnerTeamId: pickTopTeam(alive.length ? alive : teams)?.id };
      }
      return { isOver: false };
    }
    // POINTS teams: play out all rounds, highest team score wins.
    if (!questionsExhausted) return { isOver: false };
    return { isOver: true, winnerTeamId: pickTopTeam(teams)?.id };
  }

  // INDIVIDUAL
  if (state.mode === GameMode.POINTS) {
    if (!questionsExhausted) return { isOver: false };
    return { isOver: true, winnerId: pickTopParticipant(Object.values(state.participants))?.id };
  }

  const active = activeParticipants(state);
  if (active.length <= 1 || questionsExhausted) {
    const winner = pickTopParticipant(active.length ? active : Object.values(state.participants));
    return { isOver: true, winnerId: winner?.id };
  }
  return { isOver: false };
}

function pickTopParticipant(list: LiveParticipant[]): LiveParticipant | undefined {
  return [...list].sort((a, b) => b.score - a.score || a.joinOrder - b.joinOrder)[0];
}

function pickTopTeam(list: LiveTeam[]): LiveTeam | undefined {
  return [...list].sort((a, b) => b.lives - a.lives || b.score - a.score)[0];
}
