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
  teamId?: string;
  sessionTokenHash: string;
  socketId?: string;
  disconnectedAt?: number; // epoch ms, set when socket drops
  eliminatedRound?: number;
}

export interface LiveTeam {
  id: string;
  name: string;
  color: string;
  score: number;
  /** ELIMINATION mode: team lives (0 = eliminated). */
  lives: number;
  /** Max players this team may hold. */
  capacity: number;
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
  /** Ordered question ids drawn from the package. */
  questionOrder: string[];
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
}
