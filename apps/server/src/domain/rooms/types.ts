/**
 * Authoritative live room state (held in Redis, mutated only by the server).
 * This is the in-memory truth the game engine (Phase 4) operates on; the REST
 * bootstrap (Phase 3) creates it empty in LOBBY.
 */
import type {
  GameType,
  GameMode,
  GameStatus,
  RoundPhase,
  ParticipantStatus,
  GameSettings,
  PublicQuestion,
  RoundHero,
  SeenJeemPhase,
  Lifeline,
} from '@tahaddi/shared';

export interface LiveParticipant {
  id: string;
  nickname: string;
  avatarId: string;
  status: ParticipantStatus;
  score: number;
  lives: number;
  joinOrder: number;
  /** Tiebreakers for an equal-score finish (INDIVIDUAL POINTS): more correct
   *  answers wins, then the faster cumulative correct-answer time. So a tie is
   *  decided by merit (more right / answered quicker), never by join order. */
  correctCount: number;
  speedMs: number;
  teamId?: string;
  /** Per-player-category mode: this player's chosen category id. */
  categoryId?: string;
  sessionTokenHash: string;
  /** Linked player-account id (set when the player joined while logged in);
   *  used to accrue wins / games-played to the profile when the game ends. */
  playerId?: string;
  socketId?: string;
  disconnectedAt?: number; // epoch ms, set when socket drops
  eliminatedRound?: number;
}

export interface LiveTeam {
  id: string;
  name: string;
  color: string;
  score: number;
  /**
   * Tiebreaker: cumulative response time (ms) of the first-correct answers on the
   * rounds this team WON. Lower = faster overall. Used only to break an equal-score
   * finish in TEAMS points mode (the faster team wins). 0 = won nothing yet.
   */
  winMs: number;
  /** Legacy/unused in team mode (points-only). Kept for the schema default. */
  lives: number;
  /** Optional max players per team; null = unlimited (players choose freely). */
  capacity: number | null;
  /**
   * The member who answers for this team (client rule 2026-08-12). Only the leader
   * may lock the team's answer — teammates advise out loud. Stamped when the first
   * player joins the team and reassignable by the host. If the stored leader isn't
   * ACTIVE right now the engine falls back to the earliest-joined active member, so
   * a dropped phone never freezes the team (see domain/game/teams.ts).
   */
  leaderId?: string;
}

export interface LiveRound {
  roundId: string;
  index: number;
  questionId: string;
  /** Server-only: never serialized into client-facing payloads before reveal. */
  correctOptionId: string;
  /** Public projection cached so reconnects don't re-hit the DB. */
  question: PublicQuestion;
  startedAt: number;
  endsAt: number;
  phase: RoundPhase;
  timeLimitSec: number;
  basePoints: number;
  speedBonus: boolean;
  /** participantId -> { optionId, serverTs } collected during COLLECTING. */
  answers: Record<string, { optionId: string; serverTs: number }>;
  /**
   * TEAMS points games: the ONE team allowed to answer this round. Members of any
   * other team are rejected by `submitAnswer` and excluded from scoring. Undefined
   * in INDIVIDUAL games (everyone answers every question).
   */
  answeringTeamId?: string;
  /**
   * TEAMS points games: this round is the STEAL re-run of the previous question —
   * the owning team got it wrong (or timed out) so the same question was re-opened
   * for the other team. A steal is never itself stolen (one attempt each).
   */
  isSteal?: boolean;
  /** Sudden-death overtime round: decided by fastest correct among the tied
   *  contenders, not by normal scoring. */
  isTiebreak?: boolean;
}

// ───────────────────────── Seen-Jeem live state (server-only) ───────────────
// Mirrors the public projection in @tahaddi/shared, but also holds the secrets
// (questionId, correctOptionId) that must never reach a client before reveal.

export interface SJCategory {
  categoryId: string;
  nameAr: string;
  nameEn?: string;
  color: string;
  icon?: string;
  ownerTeamId?: string;
}

export interface SJCell {
  cellId: string;
  categoryId: string;
  points: number;
  questionId: string;
  /** Server-only — disclosed only on CELL_RESOLVED. */
  correctOptionId: string;
  consumed: boolean;
  awardedTeamId?: string;
  awardedPoints?: number;
}

export interface SJActive {
  cellId: string;
  doubled: boolean;
  removedOptionIds: string[];
  answeringTeamId: string;
  endsAt: number;
  /** Server-measured open time, for response-time bookkeeping. */
  openedAt: number;
  /** Public projection of the open question, cached for sync snapshots. */
  question?: PublicQuestion;
  /** participant who submitted (turn-based, one answer per cell). */
  selectedOptionId?: string;
  answeredBy?: string;
}

export interface LiveSeenJeem {
  phase: SeenJeemPhase;
  /** The two competing team ids, draft order index 0 picks first. */
  teamIds: [string, string];
  categories: SJCategory[];
  board: SJCell[];
  /** Alternating team ids; length = CATEGORIES_ON_BOARD. */
  draftOrder: string[];
  draftIndex: number;
  turnTeamId: string;
  /** teamId → (lifeline → available). */
  lifelines: Record<string, Record<Lifeline, boolean>>;
  active?: SJActive;
}

export interface RoomState {
  gameId: string;
  roomCode: string;
  /** Who competes (chosen first). */
  type: GameType;
  /** How scoring works (chosen second). */
  mode: GameMode;
  status: GameStatus;
  settings: GameSettings;
  hostTokenHash: string;
  packageId: string;
  /** Host's Player account id when they created the room logged in. Used to charge
   *  the paid game-credit at START (see engine.startGame), not at room creation. */
  hostPlayerId?: string;
  /** Ordered question ids drawn from the package. */
  questionOrder: string[];
  /** Per-player-category mode: participantId whose category owns each round
   *  (aligned with questionOrder). Empty/undefined otherwise. */
  roundOwners?: string[];
  /**
   * TEAMS points games: the fixed turn order (team ids), frozen at start so the
   * alternation survives restarts and reconnects. Question N belongs to
   * `teamOrder[N % teamOrder.length]`; the steal goes to the next team in the ring.
   */
  teamOrder?: string[];
  /**
   * TEAMS points games: a steal is queued — the team on the clock missed the
   * current question and this team gets to answer the SAME question next. Held on
   * the room state (not just in the auto-advance timer) so a pause/resume or a
   * server restart during the recap window still plays the steal instead of
   * skipping to a fresh question. Cleared when the steal round opens.
   */
  pendingSteal?: string;
  roundIndex: number; // -1 before first round
  totalRounds: number;
  participants: Record<string, LiveParticipant>;
  teams: Record<string, LiveTeam>;
  /** TEAMS mode: per-team first-correct winners of the last resolved round. */
  lastHeroes?: RoundHero[];
  currentRound: LiveRound | null;
  /** Present only when mode === SEEN_JEEM. */
  seenJeem?: LiveSeenJeem;
  hostSocketId?: string;
  createdAt: number;
  startedAt?: number;
  /** Stored remaining time when paused, to restore on resume. */
  pausedRemainingMs?: number;
  /** Set while the game is in sudden-death overtime: the still-tied contenders
   *  (participant ids, or team ids when isTeam). Cleared once a winner emerges. */
  tiebreak?: { contenders: string[]; isTeam: boolean };
  /** Question ids already spent on tiebreak rounds (so overtime doesn't repeat
   *  a question while fresh ones remain in the package). */
  usedTiebreakIds?: string[];
}
