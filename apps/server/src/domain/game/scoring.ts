/**
 * Pure scoring & elimination logic. No I/O — given inputs, returns results.
 * This is the fairness core; it is unit-tested in isolation (Phase 9).
 */
import { GameMode, ParticipantStatus, ScoringMode, PLACEMENT_POINTS } from '@tahaddi/shared';
import type { LiveParticipant, LiveRound, RoomState } from '../rooms/types.js';

export interface AnswerOutcome {
  participantId: string;
  selectedOptionId: string | null;
  isCorrect: boolean;
  responseMs: number;
  pointsAwarded: number;
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

/**
 * Placement points (الدوري): rank the round's correct answers by SERVER-measured
 * response time, award 3 / 2 / 1 (first / second / the rest). Wrong answers get 0.
 * Mutates the outcomes' pointsAwarded.
 */
export function applyPlacementPoints(outcomes: AnswerOutcome[]): void {
  const correct = outcomes
    .filter((o) => o.isCorrect)
    .sort((a, b) => a.responseMs - b.responseMs);
  correct.forEach((o, i) => {
    o.pointsAwarded =
      i === 0 ? PLACEMENT_POINTS.FIRST : i === 1 ? PLACEMENT_POINTS.SECOND : PLACEMENT_POINTS.REST;
  });
}

/** Resolve every active participant's answer for a round. */
export function resolveAnswers(state: RoomState, round: LiveRound): AnswerOutcome[] {
  const windowMs = round.timeLimitSec * 1000;
  const placement = state.settings.scoringMode === ScoringMode.PLACEMENT;
  const outcomes: AnswerOutcome[] = [];

  for (const p of Object.values(state.participants)) {
    if (p.status !== ParticipantStatus.ACTIVE) continue;
    const submitted = round.answers[p.id];
    const isCorrect = !!submitted && submitted.optionId === round.correctOptionId;
    const responseMs = submitted ? Math.max(0, submitted.serverTs - round.startedAt) : windowMs;
    // SPEED points are per-player; PLACEMENT is assigned after, by rank.
    const pointsAwarded =
      isCorrect && !placement
        ? computePoints(round.basePoints, round.speedBonus, responseMs, windowMs)
        : 0;
    outcomes.push({
      participantId: p.id,
      selectedOptionId: submitted?.optionId ?? null,
      isCorrect,
      responseMs,
      pointsAwarded,
    });
  }

  if (placement) applyPlacementPoints(outcomes);
  return outcomes;
}

export interface ResolutionResult {
  outcomes: AnswerOutcome[];
  eliminatedIds: string[];
}

/**
 * Apply outcomes to participant state (scores, lives, eliminations) per mode.
 * Mutates the participants in `state`. Returns who was eliminated this round.
 */
export function applyResolution(
  state: RoomState,
  round: LiveRound,
  outcomes: AnswerOutcome[],
): ResolutionResult {
  const eliminatedIds: string[] = [];
  const suddenDeath = state.mode === GameMode.SUDDEN_DEATH;
  // League (الدوري) is pure points accumulation — nobody is ever eliminated.
  const noElimination = state.mode === GameMode.LEAGUE;

  for (const o of outcomes) {
    const p = state.participants[o.participantId];
    if (!p) continue;
    p.score += o.pointsAwarded;

    if (!o.isCorrect && !noElimination) {
      // Sudden death: a single wrong answer eliminates regardless of lives.
      // Cup (الكأس): lose one life, out at zero.
      const lost = suddenDeath ? p.lives : 1;
      p.lives = Math.max(0, p.lives - lost);
      if (p.lives <= 0) {
        p.status = ParticipantStatus.ELIMINATED;
        p.eliminatedRound = round.index;
        eliminatedIds.push(p.id);
      }
    }
  }

  // Recompute team scores (teams mode).
  if (state.mode === GameMode.TEAMS) {
    for (const team of Object.values(state.teams)) team.score = 0;
    for (const p of Object.values(state.participants)) {
      if (p.teamId && state.teams[p.teamId]) state.teams[p.teamId]!.score += p.score;
    }
  }

  return { outcomes, eliminatedIds };
}

/** Players still in the running. */
export function activeParticipants(state: RoomState): LiveParticipant[] {
  return Object.values(state.participants).filter(
    (p) => p.status === ParticipantStatus.ACTIVE,
  );
}

export interface WinCondition {
  isOver: boolean;
  /** Single winner (individual / sudden death) if decided. */
  winnerId?: string;
  /** Winning team id (teams mode) if decided. */
  winnerTeamId?: string;
}

/**
 * Determine whether the game is over and who won.
 *  - Elimination modes: over when ≤1 active player remains, OR questions exhausted.
 *  - Teams: over when ≤1 team has active members, OR questions exhausted → highest score.
 *  - When questions run out with multiple survivors, highest score wins (ties → earliest joinOrder).
 */
export function evaluateWinCondition(state: RoomState, questionsExhausted: boolean): WinCondition {
  const active = activeParticipants(state);

  // League (الدوري): no elimination — the game ends only when the rounds run out,
  // and the highest total wins (ties → earliest joinOrder).
  if (state.mode === GameMode.LEAGUE) {
    if (!questionsExhausted) return { isOver: false };
    return { isOver: true, winnerId: pickTopParticipant(Object.values(state.participants))?.id };
  }

  if (state.mode === GameMode.TEAMS) {
    const teamsWithActive = new Set(active.map((p) => p.teamId).filter(Boolean) as string[]);
    if (teamsWithActive.size <= 1 || questionsExhausted) {
      const ranked = Object.values(state.teams).sort((a, b) => b.score - a.score);
      return { isOver: true, winnerTeamId: ranked[0]?.id };
    }
    return { isOver: false };
  }

  if (active.length <= 1 || questionsExhausted) {
    const winner = pickTopParticipant(active.length ? active : Object.values(state.participants));
    return { isOver: true, winnerId: winner?.id };
  }
  return { isOver: false };
}

function pickTopParticipant(list: LiveParticipant[]): LiveParticipant | undefined {
  return [...list].sort((a, b) => b.score - a.score || a.joinOrder - b.joinOrder)[0];
}
