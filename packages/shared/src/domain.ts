/**
 * Shared domain enums & constants — the vocabulary used across server and all
 * clients. These mirror the Prisma enums so the wire contract and the DB never
 * disagree.
 */

/**
 * Game **type** — chosen FIRST when creating a game (who is competing).
 * This is the orthogonal axis to {@link GameMode}.
 */
export const GameType = {
  /** Every player competes for themselves. */
  INDIVIDUAL: 'INDIVIDUAL',
  /** Team vs team — players join a specific team; the team scores, not the player. */
  TEAMS: 'TEAMS',
} as const;
export type GameType = (typeof GameType)[keyof typeof GameType];

/**
 * Gameplay **mode** — chosen SECOND when creating a game (how scoring works).
 * Orthogonal to {@link GameType}: any type can run any mode.
 */
export const GameMode = {
  /** لعبة النقاط — accumulate points across a fixed number of rounds, placement
   *  scoring, no elimination. Highest score wins. (was: LEAGUE) */
  POINTS: 'POINTS',
  /** لعبة التصفيات — lives-based: a wrong answer costs a life, last one (or last
   *  team) standing wins. (was: CUP / SUDDEN_DEATH) */
  ELIMINATION: 'ELIMINATION',
  /** سين جيم — turn-based board format: category draft + lifelines. Always teams. */
  SEEN_JEEM: 'SEEN_JEEM',
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

/**
 * Game **tier** — free vs paid, chosen when creating an INDIVIDUAL game.
 *  - FREE: a fixed 15-question set, no category selection. No login required.
 *  - PAID: the full 35-question game with category selection. Requires a
 *    logged-in host whose account has the one-time paid unlock ({@link PAID_UNLOCK_SKU}).
 */
export const GameTier = {
  FREE: 'FREE',
  PAID: 'PAID',
} as const;
export type GameTier = (typeof GameTier)[keyof typeof GameTier];

/** Authoritative question count per tier (the server enforces these). */
export const TIER_ROUNDS: Record<GameTier, number> = {
  FREE: 15,
  PAID: 35,
};

/** Slug of the seeded free pack (the fixed 15-question, no-category set). */
export const FREE_PACKAGE_SLUG = 'free-15';

/** SKU of the legacy one-time unlock (retired — replaced by credit packages). */
export const PAID_UNLOCK_SKU = 'paid_unlock';

/**
 * The paid catalog: game-credit packages (البقاء للأقوى). Buying a package adds
 * `credits` game-starts to the host's wallet; each PAID (35-question) game a host
 * starts consumes one credit. Prices are minor units (halalas; 2000 = 20 SAR).
 * This is the single source of truth for the seed and the storefront.
 */
export const CREDIT_PACKAGES = [
  { sku: 'game_1', nameAr: 'باقة لعبة واحدة', nameEn: '1 Game', credits: 1, priceMinor: 2000 },
  { sku: 'game_2', nameAr: 'باقة لعبتين', nameEn: '2 Games', credits: 2, priceMinor: 3500 },
  { sku: 'game_5', nameAr: 'باقة ٥ ألعاب', nameEn: '5 Games', credits: 5, priceMinor: 7500 },
  { sku: 'game_10', nameAr: 'باقة ١٠ ألعاب', nameEn: '10 Games', credits: 10, priceMinor: 10000 },
] as const;

/** The valid package SKUs a checkout may request. */
export const CREDIT_PACKAGE_SKUS = CREDIT_PACKAGES.map((p) => p.sku) as readonly string[];

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
  TAP: 'TAP',
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
  /** Who competes — chosen first. */
  type: GameType;
  /** How scoring works — chosen second. */
  mode: GameMode;
  maxPlayers: number; // 2..100
  minPlayers: number; // >= 2
  questionTimerSec: number; // default per-question time
  livesPerPlayer: number; // 1 = classic elimination
  speedBonus: boolean; // award faster correct answers more points
  intermissionSec: number; // pause between rounds
  autoAdvance: boolean; // advance rounds without host input
  totalRounds: number | null; // null = use whole package
  /** TEAMS type only: how many teams compete (2..8). Derived from teamNames. */
  teamCount?: number;
  /** TEAMS type only: the host-entered team names (≥2). The number of names
   *  decides how many teams there are. */
  teamNames?: string[];
  /** TEAMS type only: optional max players per team. Omitted = unlimited. */
  playersPerTeam?: number;
  /** SEEN_JEEM only: which team drafts first (null = lower joinOrder). */
  firstTeamId?: string | null;
  /** How points are awarded each round (default derived from mode). */
  scoringMode?: ScoringMode;
  /** Optional display name for the tournament/session (البطولة). */
  tournamentName?: string;
  /** Chosen trivia category (id). When set, the room's questions are drawn from
   *  this category (generated on demand) instead of the package's question list. */
  categoryId?: string;
  /** Per-player-category mode: each player picks their own category in the lobby;
   *  rounds rotate through players, each drawing from that player's category. */
  perPlayerCategory?: boolean;
  /** Free vs paid tier (INDIVIDUAL games). Frozen onto the game at create time;
   *  the server sets the package + round count from it. Defaults to FREE. */
  tier?: GameTier;
}

export const GAME_LIMITS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 100,
  MIN_TIMER_SEC: 5,
  MAX_TIMER_SEC: 120,
  MIN_LIVES: 1,
  MAX_LIVES: 5,
  MIN_TEAMS: 2,
  MAX_TEAMS: 2, // client requirement: team mode is exactly two teams (Team A / Team B)
  MIN_PLAYERS_PER_TEAM: 1,
  MAX_PLAYERS_PER_TEAM: 20,
  NICKNAME_MIN: 2,
  NICKNAME_MAX: 20,
  ROOM_CODE_LENGTH: 6,
} as const;

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  type: GameType.INDIVIDUAL,
  mode: GameMode.POINTS,
  maxPlayers: 100,
  minPlayers: 2,
  questionTimerSec: 15,
  livesPerPlayer: 1,
  speedBonus: false,
  // Between-round window: holds the correct-answer recap (~2.5s) then the standings
  // before the next question's short pre-roll. Kept tight so the game never drags
  // between questions (client feedback 2026-07-21: still felt slow → 8s → 5s).
  intermissionSec: 5,
  autoAdvance: true,
  totalRounds: 15, // production (2026-07-17): 15-round game for single + teams; PAID individual games use TIER_ROUNDS (35) + category selection.
  scoringMode: ScoringMode.PLACEMENT,
};

/** Resolve the effective scoring mode for a game (mode-driven default). */
export function defaultScoringMode(mode: GameMode): ScoringMode {
  return mode === GameMode.POINTS ? ScoringMode.PLACEMENT : ScoringMode.SPEED;
}

/** Default team config when a TEAMS game omits explicit values. */
export const DEFAULT_TEAM_COUNT = 2;
export const DEFAULT_PLAYERS_PER_TEAM = 4;

/** لعبة النقاط — accumulate points over 35 rounds, placement scoring, no elimination. */
export const POINTS_SETTINGS: GameSettings = {
  ...DEFAULT_GAME_SETTINGS,
  mode: GameMode.POINTS,
  livesPerPlayer: 1, // unused in points mode (no elimination)
  speedBonus: false,
  scoringMode: ScoringMode.PLACEMENT,
  totalRounds: 15, // production (2026-07-17): 15-round game for single + teams; PAID individual games use TIER_ROUNDS (35) + category selection.
  intermissionSec: 5,
};

/** لعبة التصفيات — 3 lives, wrong answer loses a life, last one standing wins.
 *  Plays to the last survivor: the engine keeps drawing questions (recycling the
 *  category/package) until one player holds lives, so `totalRounds` is only the
 *  scripted minimum, not a cap. */
export const ELIMINATION_SETTINGS: GameSettings = {
  ...DEFAULT_GAME_SETTINGS,
  mode: GameMode.ELIMINATION,
  livesPerPlayer: 3,
  speedBonus: true,
  scoringMode: ScoringMode.SPEED, // points only matter for tie-breaks
  totalRounds: 15, // production (2026-07-17): 15-round game for single + teams; PAID individual games use TIER_ROUNDS (35) + category selection.
};
