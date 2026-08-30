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
  /** The winning answer's response time (ms) — fed into the team's tiebreaker total. */
  responseMs: number;
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

/**
 * Build raw outcomes (correctness + server response time) for the players who
 * were eligible to answer this round.
 *
 * TEAMS points games are turn-based: only `round.answeringTeamId` was allowed to
 * answer, so only that team's players get an outcome. The other team must NOT
 * appear here — otherwise they'd be recorded as "no answer / wrong" on a question
 * that was never theirs, and their Answer rows would collide with the steal re-run
 * (Answer is unique per round+participant, and a steal reuses the round row).
 */
function baseOutcomes(state: RoomState, round: LiveRound): AnswerOutcome[] {
  const windowMs = round.timeLimitSec * 1000;
  const outcomes: AnswerOutcome[] = [];
  for (const p of Object.values(state.participants)) {
    if (p.status !== ParticipantStatus.ACTIVE) continue;
    if (round.answeringTeamId && p.teamId !== round.answeringTeamId) continue;
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
 * TEAMS scoring: the score belongs to the TEAM, and a question is worth a FLAT +1.
 *
 * Team games are turn-based (client rule 2026-08-06): each question belongs to one
 * team, and `baseOutcomes` has already narrowed `outcomes` to that team. The first
 * correct answer from the team on the clock takes the point — whether this is the
 * team's own question or a steal of the other team's missed one. At most one team
 * scores per question.
 */
function scoreTeams(state: RoomState, outcomes: AnswerOutcome[]): TeamHero[] {
  let best: AnswerOutcome | undefined;
  for (const o of outcomes) {
    if (!o.isCorrect) continue;
    if (!state.participants[o.participantId]?.teamId) continue; // unassigned can't score
    if (!best || o.responseMs < best.responseMs) best = o;
  }
  if (!best) return [];
  const teamId = state.participants[best.participantId]!.teamId!;
  best.pointsAwarded = 1; // display only; the +1 is applied to the TEAM total
  best.isTeamHero = true;
  return [{ teamId, participantId: best.participantId, pointsAwarded: 1, responseMs: best.responseMs }];
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
  /**
   * ELIMINATION only — what happened when a round would have knocked EVERY
   * remaining player out at once (they were all on their last life and all got it
   * wrong):
   *   'replay'  — nobody lost a life, the duel simply carries on (a free retry);
   *   'decided' — the free retries are spent, so the round was settled: everyone
   *               lost their last life except the one player kept in on record.
   * Undefined on a normal round.
   */
  stalemate?: 'replay' | 'decided';
  /** ELIMINATION only — the round was settled on speed because the duel had run
   *  past the overtime limit with nobody going out. */
  suddenDeath?: boolean;
}

/**
 * ELIMINATION deadlock rules (client 2026-08-30).
 *
 * Two players both on their last life who both answer wrong used to be a dead end:
 * the "never wipe everyone" safety net refused to take anyone's last life, so no
 * one was ever eliminated and the match ran «جولة إضافية» forever with the host's
 * game-credit already spent. Both of these now guarantee the duel ends:
 *
 *  1. All remaining players wrong on their last life → the question is replayed
 *     free of charge (nobody loses a life) at most ELIMINATION_FREE_REPLAYS times
 *     in a row. After that the round is DECIDED: everyone goes out except the
 *     player with the best record (see {@link bestOnRecord}).
 *  2. A duel where nobody ever misses is capped too — once the game is
 *     ELIMINATION_OVERTIME_LIMIT rounds past its scripted length, each round is
 *     sudden death: only the fastest correct answer survives it.
 */
export const ELIMINATION_FREE_REPLAYS = 2;
export const ELIMINATION_OVERTIME_LIMIT = 10;

/**
 * Is round `index` (0-based) inside elimination sudden death — i.e. so far past
 * the scripted question count that the match has to be settled on speed?
 */
export function isEliminationSuddenDeath(state: RoomState, index: number): boolean {
  if (state.type !== GameType.INDIVIDUAL || state.mode !== GameMode.ELIMINATION) return false;
  if (!state.totalRounds || state.totalRounds <= 0) return false;
  return index + 1 > state.totalRounds + ELIMINATION_OVERTIME_LIMIT;
}

/**
 * Who stays in when a round has to be decided rather than replayed. Merit first —
 * more lives, then more correct answers this game, then the faster cumulative
 * correct-answer time — and only join order as the final, never-reached fallback.
 */
function bestOnRecord(players: LiveParticipant[]): LiveParticipant | undefined {
  return [...players].sort(
    (a, b) =>
      b.lives - a.lives ||
      (b.correctCount ?? 0) - (a.correctCount ?? 0) ||
      (a.speedMs ?? 0) - (b.speedMs ?? 0) ||
      a.joinOrder - b.joinOrder,
  )[0];
}

/** The fastest correct answer of this round among `players` (undefined if none). */
function fastestCorrect(
  outcomes: AnswerOutcome[],
  players: LiveParticipant[],
): LiveParticipant | undefined {
  const alive = new Set(players.map((p) => p.id));
  const best = outcomes
    .filter((o) => o.isCorrect && alive.has(o.participantId))
    .sort((a, b) => a.responseMs - b.responseMs)[0];
  return best ? players.find((p) => p.id === best.participantId) : undefined;
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
      if (team) {
        team.score += 1;
        team.winMs += hero.responseMs; // faster wins accumulate less time → tiebreaker
      }
    }
    return { eliminatedIds: [] };
  }

  // INDIVIDUAL: award personal points (POINTS mode only; elimination awards none).
  for (const o of scored.outcomes) {
    const p = state.participants[o.participantId];
    if (!p) continue;
    p.score += o.pointsAwarded;
    // Track merit-based tiebreakers for an equal-score finish.
    if (o.isCorrect) {
      p.correctCount = (p.correctCount ?? 0) + 1;
      p.speedMs = (p.speedMs ?? 0) + o.responseMs;
    }
  }

  const eliminatedIds: string[] = [];
  let stalemate: 'replay' | 'decided' | undefined;
  let suddenDeath = false;

  if (state.mode === GameMode.ELIMINATION) {
    const activeBefore = activeParticipants(state);
    const knockOut = (p: LiveParticipant): void => {
      p.lives = Math.max(0, p.lives - 1);
      if (p.lives <= 0) {
        p.status = ParticipantStatus.ELIMINATED;
        p.eliminatedRound = round.index;
        eliminatedIds.push(p.id);
      }
    };
    // Active players who got it wrong (or didn't answer) — they'd lose a life.
    const wrongActive = scored.outcomes.filter((o) => {
      const p = state.participants[o.participantId];
      return p && p.status === ParticipantStatus.ACTIVE && !o.isCorrect;
    });
    // Of those, who would drop to 0 lives and be eliminated.
    const wouldExit = wrongActive.filter(
      (o) => state.participants[o.participantId]!.lives - 1 <= 0,
    );
    // Would this round knock EVERY remaining player out at once? The game must
    // still produce a winner, so it can't simply take everyone's last life.
    const wipesEveryone = activeBefore.length > 0 && activeBefore.length - wouldExit.length <= 0;

    if (wipesEveryone) {
      const streak = (state.stalemateStreak ?? 0) + 1;
      if (streak <= ELIMINATION_FREE_REPLAYS) {
        // Give them a couple of free retries first: nobody loses a life and the
        // duel carries on with another question.
        state.stalemateStreak = streak;
        stalemate = 'replay';
      } else {
        // The retries are spent — settle it. Everyone still takes the hit except
        // the one player kept in on record, so the match ends with a champion
        // instead of looping «جولة إضافية» forever (client 2026-08-30).
        const spared = bestOnRecord(activeBefore)?.id;
        for (const o of wrongActive) {
          const p = state.participants[o.participantId]!;
          if (p.id === spared) continue;
          knockOut(p);
        }
        state.stalemateStreak = 0;
        stalemate = 'decided';
      }
    } else {
      state.stalemateStreak = 0;
      // A wrong (or missing) answer costs a life; 0 lives → eliminated this round.
      for (const o of wrongActive) knockOut(state.participants[o.participantId]!);
    }

    // Endless-duel cap: two players who never miss would play forever. Once the
    // match is well past its scripted length, a round that eliminated nobody is
    // settled on speed — only the fastest correct answer survives it.
    if (!eliminatedIds.length && isEliminationSuddenDeath(state, round.index)) {
      const survivors = activeParticipants(state);
      if (survivors.length > 1) {
        const keep =
          fastestCorrect(scored.outcomes, survivors) ?? bestOnRecord(survivors);
        for (const p of survivors) {
          if (p.id === keep?.id) continue;
          p.lives = 0;
          p.status = ParticipantStatus.ELIMINATED;
          p.eliminatedRound = round.index;
          eliminatedIds.push(p.id);
        }
        suddenDeath = true;
        stalemate = undefined;
      }
    }
  }
  return { eliminatedIds, ...(stalemate ? { stalemate } : {}), ...(suddenDeath ? { suddenDeath } : {}) };
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
 *  - ELIMINATION (INDIVIDUAL only): ends ONLY when ≤1 player is still alive — the
 *    last survivor wins. The question count is irrelevant: the round loop keeps
 *    feeding questions (recycling the bank if needed) until a single player holds
 *    lives, so there is never a sudden-death "decisive question".
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

  // ELIMINATION: play to the last survivor, regardless of how many questions remain.
  const active = activeParticipants(state);
  if (active.length <= 1) {
    const winner = [...Object.values(state.participants)].sort(compareSurvival)[0];
    return { isOver: true, winnerId: winner?.id };
  }
  return { isOver: false };
}

function pickTopParticipant(list: LiveParticipant[]): LiveParticipant | undefined {
  return [...list].sort((a, b) => b.score - a.score || a.joinOrder - b.joinOrder)[0];
}

// ─────────────────────────────── Sudden death ────────────────────────────────

export interface Contenders {
  /** true when a single winner is already decided (no tie at the top). */
  unique: boolean;
  winnerId?: string;
  winnerTeamId?: string;
  /** The tied-for-first ids (participant ids, or team ids when isTeam). */
  contenders: string[];
  isTeam: boolean;
}

/**
 * Who's tied for first at the moment the game would end. If exactly one leader,
 * `unique` is true and the winner is set. Otherwise `contenders` lists everyone
 * tied for the top — they go to a sudden-death tiebreaker.
 *  - TEAMS: tie on team score.
 *  - INDIVIDUAL POINTS: tie on player score.
 *  - INDIVIDUAL ELIMINATION: among the survivors (most lives) — tie on lives.
 */
export function topContenders(state: RoomState): Contenders {
  if (state.type === GameType.TEAMS) {
    const teams = Object.values(state.teams);
    const max = Math.max(0, ...teams.map((t) => t.score));
    const leaders = teams.filter((t) => t.score === max);
    return leaders.length <= 1
      ? { unique: true, winnerTeamId: leaders[0]?.id, contenders: [], isTeam: true }
      : { unique: false, contenders: leaders.map((t) => t.id), isTeam: true };
  }

  if (state.mode === GameMode.ELIMINATION) {
    const alive = Object.values(state.participants).filter((p) => p.status === ParticipantStatus.ACTIVE);
    const pool = alive.length > 0 ? alive : visibleSurvivors(state);
    const maxLives = Math.max(0, ...pool.map((p) => p.lives));
    const leaders = pool.filter((p) => p.lives === maxLives);
    return leaders.length <= 1
      ? { unique: true, winnerId: leaders[0]?.id, contenders: [], isTeam: false }
      : { unique: false, contenders: leaders.map((p) => p.id), isTeam: false };
  }

  // INDIVIDUAL POINTS
  const players = visibleSurvivors(state);
  const max = Math.max(0, ...players.map((p) => p.score));
  const leaders = players.filter((p) => p.score === max);
  return leaders.length <= 1
    ? { unique: true, winnerId: leaders[0]?.id, contenders: [], isTeam: false }
    : { unique: false, contenders: leaders.map((p) => p.id), isTeam: false };
}

function visibleSurvivors(state: RoomState): LiveParticipant[] {
  return Object.values(state.participants).filter((p) => p.status !== ParticipantStatus.LEFT);
}

export interface TiebreakDecision {
  decided: boolean;
  winnerId?: string;
  winnerTeamId?: string;
  /** When undecided, the narrowed contender set to replay (those still tied). */
  contenders: string[];
  isTeam: boolean;
}

/**
 * Decide a sudden-death round: the contender who answered correctly the FASTEST
 * wins. If nobody got it right, replay with the same contenders. If two are tied
 * on the exact fastest time (practically never), replay among just those.
 */
export function decideTiebreak(state: RoomState, round: LiveRound): TiebreakDecision {
  const tb = state.tiebreak;
  if (!tb) return { decided: false, contenders: [], isTeam: false };
  const correctId = round.correctOptionId;

  if (tb.isTeam) {
    // Each team's fastest correct member time.
    const best = new Map<string, number>();
    for (const [pid, ans] of Object.entries(round.answers)) {
      const p = state.participants[pid];
      if (!p?.teamId || !tb.contenders.includes(p.teamId) || ans.optionId !== correctId) continue;
      const ms = ans.serverTs - round.startedAt;
      const cur = best.get(p.teamId);
      if (cur === undefined || ms < cur) best.set(p.teamId, ms);
    }
    const ranked = [...best.entries()].sort((a, b) => a[1] - b[1]);
    if (ranked.length === 0) return { decided: false, contenders: tb.contenders, isTeam: true };
    if (ranked.length === 1 || ranked[0]![1] < ranked[1]![1]) {
      return { decided: true, winnerTeamId: ranked[0]![0], contenders: [], isTeam: true };
    }
    const top = ranked[0]![1];
    return { decided: false, contenders: ranked.filter(([, ms]) => ms === top).map(([id]) => id), isTeam: true };
  }

  const correct = tb.contenders
    .map((id) => ({ id, ans: round.answers[id] }))
    .filter((x) => x.ans && x.ans.optionId === correctId)
    .map((x) => ({ id: x.id, ms: x.ans!.serverTs - round.startedAt }))
    .sort((a, b) => a.ms - b.ms);
  if (correct.length === 0) return { decided: false, contenders: tb.contenders, isTeam: false };
  if (correct.length === 1 || correct[0]!.ms < correct[1]!.ms) {
    return { decided: true, winnerId: correct[0]!.id, contenders: [], isTeam: false };
  }
  const top = correct[0]!.ms;
  return { decided: false, contenders: correct.filter((c) => c.ms === top).map((c) => c.id), isTeam: false };
}

function pickTopTeam(list: LiveTeam[]): LiveTeam | undefined {
  // Highest score wins; on an equal-score tie the FASTER team wins (lower cumulative
  // buzz time across the rounds it won).
  return [...list].sort((a, b) => b.score - a.score || a.winMs - b.winMs)[0];
}
