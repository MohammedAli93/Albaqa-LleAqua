/**
 * Shared domain enums & constants — the vocabulary used across server and all
 * clients. These mirror the Prisma enums so the wire contract and the DB never
 * disagree.
 */

export const GameMode = {
  INDIVIDUAL: 'INDIVIDUAL',
  TEAMS: 'TEAMS',
  SUDDEN_DEATH: 'SUDDEN_DEATH',
  TOURNAMENT: 'TOURNAMENT',
  /** Turn-based board format: category draft + lifelines (سين جيم). */
  SEEN_JEEM: 'SEEN_JEEM',
  /** Points league (الدوري): 20–30 rounds, placement scoring, no elimination. */
  LEAGUE: 'LEAGUE',
  /** Knockout cup (الكأس): 3 lives, wrong answer loses a life, last one standing. */
  CUP: 'CUP',
} as const;
export type GameMode = (typeof GameMode)[keyof typeof GameMode];

/** How a round's points are awarded. */
export const ScoringMode = {
  /** Base points + up to +50% by remaining time (default). */
  SPEED: 'SPEED',
  /** Placement: 1st correct = 3, 2nd = 2, the rest correct = 1, wrong = 0. */
  PLACEMENT: 'PLACEMENT',
} as const;
export type ScoringMode = (typeof ScoringMode)[keyof typeof ScoringMode];

/** Placement-scoring point values (البقاء للأقوى — الدوري). */
export const PLACEMENT_POINTS = { FIRST: 3, SECOND: 2, REST: 1 } as const;

export const GameStatus = {
  LOBBY: 'LOBBY',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  ABANDONED: 'ABANDONED',
} as const;
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

/** Per-round lifecycle phase (sub-state while a game is ACTIVE). */
export const RoundPhase = {
  COLLECTING: 'COLLECTING',
  LOCKED: 'LOCKED',
  RESOLVING: 'RESOLVING',
  INTERMISSION: 'INTERMISSION',
} as const;
export type RoundPhase = (typeof RoundPhase)[keyof typeof RoundPhase];

export const ParticipantStatus = {
  ACTIVE: 'ACTIVE',
  ELIMINATED: 'ELIMINATED',
  DISCONNECTED: 'DISCONNECTED',
  LEFT: 'LEFT',
  WINNER: 'WINNER',
} as const;
export type ParticipantStatus =
  (typeof ParticipantStatus)[keyof typeof ParticipantStatus];

export const QuestionType = {
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  TRUE_FALSE: 'TRUE_FALSE',
  IMAGE: 'IMAGE',
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export const Difficulty = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
  EXPERT: 'EXPERT',
} as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Role rank for `requireRole(min)` comparisons. Higher = more privileged. */
export const ROLE_RANK: Record<UserRole, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export const PaymentProviderId = {
  STRIPE: 'STRIPE',
  PAYMOB: 'PAYMOB',
  MADA: 'MADA',
  FAWRY: 'FAWRY',
  APPLE_PAY: 'APPLE_PAY',
  GOOGLE_PAY: 'GOOGLE_PAY',
} as const;
export type PaymentProviderId =
  (typeof PaymentProviderId)[keyof typeof PaymentProviderId];

// ─────────────────────────── Game settings & limits ─────────────────────────

/** Settings frozen onto a Game at start. Tunable per room within these bounds. */
export interface GameSettings {
  mode: GameMode;
  maxPlayers: number; // 2..100
  minPlayers: number; // >= 2
  questionTimerSec: number; // default per-question time
  livesPerPlayer: number; // 1 = classic elimination
  speedBonus: boolean; // award faster correct answers more points
  intermissionSec: number; // pause between rounds
  autoAdvance: boolean; // advance rounds without host input
  totalRounds: number | null; // null = use whole package
  /** Teams mode only. */
  teamCount?: number;
  /** SEEN_JEEM only: which team drafts first (null = lower joinOrder). */
  firstTeamId?: string | null;
  /** How points are awarded each round (default SPEED). */
  scoringMode?: ScoringMode;
  /** Optional display name for the tournament/session (البطولة). */
  tournamentName?: string;
}

export const GAME_LIMITS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 100,
  MIN_TIMER_SEC: 5,
  MAX_TIMER_SEC: 120,
  MIN_LIVES: 1,
  MAX_LIVES: 5,
  MAX_TEAMS: 8,
  NICKNAME_MIN: 2,
  NICKNAME_MAX: 20,
  ROOM_CODE_LENGTH: 6,
} as const;

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  mode: GameMode.INDIVIDUAL,
  maxPlayers: 100,
  minPlayers: 2,
  questionTimerSec: 15,
  livesPerPlayer: 1,
  speedBonus: true,
  intermissionSec: 5,
  autoAdvance: true,
  totalRounds: null,
};

/** الدوري — accumulate points over 25 rounds, placement scoring, no elimination. */
export const LEAGUE_SETTINGS: GameSettings = {
  ...DEFAULT_GAME_SETTINGS,
  mode: GameMode.LEAGUE,
  livesPerPlayer: 1, // unused in league (no elimination)
  speedBonus: false,
  scoringMode: ScoringMode.PLACEMENT,
  totalRounds: 25,
  intermissionSec: 5,
};

/** الكأس — knockout: 3 lives, wrong answer loses a life, last one standing wins. */
export const CUP_SETTINGS: GameSettings = {
  ...DEFAULT_GAME_SETTINGS,
  mode: GameMode.CUP,
  livesPerPlayer: 3,
  speedBonus: true,
  scoringMode: ScoringMode.SPEED, // points only matter for tie-breaks
  totalRounds: null,
};
