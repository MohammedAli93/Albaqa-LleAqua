/**
 * WebSocket event contract (doc 05). Event names + Zod payload schemas shared by
 * server and clients. The server validates every inbound intent against these
 * schemas; clients derive their emit/listen types from them.
 */
import { z } from 'zod';
import {
  GameType,
  GameMode,
  GameStatus,
  RoundPhase,
  ParticipantStatus,
  QuestionType,
  Difficulty,
  GAME_LIMITS,
} from './domain.js';
import {
  SeenJeemPhase,
  Lifeline,
  DraftPickSchema,
  CellSelectSchema,
  LifelineUseSchema,
  TeamAnswerSchema,
  AdjudicateSchema,
  type PublicSeenJeemCategory,
  type PublicBoardCell,
  type PublicLifelineState,
} from './seenjeem.js';

// ───────────────────────────── Event name registry ──────────────────────────

/** Client → Server intents. */
export const ClientEvent = {
  PLAYER_JOIN: 'player:join',
  PLAYER_PICK_TEAM: 'player:pickTeam',
  PLAYER_PICK_CATEGORY: 'player:pickCategory',
  PLAYER_ANSWER: 'player:answer',
  PLAYER_HEARTBEAT: 'player:heartbeat',
  /** Resync: client asks the server to re-send the authoritative room snapshot.
   *  Fired when the app returns to the foreground / regains network so a device
   *  that silently missed an event (backgrounded phone, flaky tunnel) self-heals
   *  without the player having to reload the page. */
  PLAYER_RESYNC: 'player:resync',
  /** Clock sync: client pings, server acks its wall-clock so the client can
   *  compute its offset and run the pre-roll/timer off true server time. */
  TIME_SYNC: 'time:sync',
  PLAYER_LEAVE: 'player:leave',
  GAME_START: 'game:start',
  ROUND_NEXT: 'round:next',
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',
  PLAYER_KICK: 'player:kick',
  GAME_END: 'game:end',
  ADMIN_SUBSCRIBE: 'admin:subscribe',
  ADMIN_ROOM_TERMINATE: 'admin:room:terminate',
  // Seen-Jeem mode intents
  SJ_DRAFT_PICK: 'sj:draft:pick',
  SJ_CELL_SELECT: 'sj:cell:select',
  SJ_LIFELINE_USE: 'sj:lifeline:use',
  SJ_TEAM_ANSWER: 'sj:team:answer',
  SJ_ADJUDICATE: 'sj:adjudicate',
} as const;
export type ClientEvent = (typeof ClientEvent)[keyof typeof ClientEvent];

/** Server → Client notifications. */
export const ServerEvent = {
  ROOM_STATE: 'room:state',
  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left',
  PLAYER_RECONNECTED: 'player:reconnected',
  GAME_STARTED: 'game:started',
  QUESTION_SHOW: 'question:show',
  TIMER_TICK: 'timer:tick',
  ANSWER_RECEIVED: 'answer:received',
  ANSWER_LOCKED: 'answer:locked',
  QUESTION_REVEAL: 'question:reveal',
  ANSWER_RESULT: 'answer:result',
  SCORE_UPDATE: 'score:update',
  PLAYER_ELIMINATED: 'player:eliminated',
  YOU_ELIMINATED: 'you:eliminated',
  /** TEAMS mode: the first player to answer correctly earned the team a point. */
  TEAM_SCORED: 'team:scored',
  ROUND_COMPLETED: 'round:completed',
  GAME_PAUSED: 'game:paused',
  GAME_RESUMED: 'game:resumed',
  GAME_COMPLETED: 'game:completed',
  ERROR: 'error',
  // Seen-Jeem mode notifications
  SJ_STATE: 'sj:state', // full board/draft/lifeline projection
  SJ_DRAFT_UPDATED: 'sj:draft:updated',
  SJ_TURN_CHANGED: 'sj:turn:changed',
  SJ_CELL_OPENED: 'sj:cell:opened', // question revealed to the answering team
  SJ_LIFELINE_USED: 'sj:lifeline:used',
  SJ_CELL_RESOLVED: 'sj:cell:resolved',
} as const;
export type ServerEvent = (typeof ServerEvent)[keyof typeof ServerEvent];

// ───────────────────────────── Shared sub-schemas ───────────────────────────

const zEnum = <T extends Record<string, string>>(e: T) =>
  z.enum(Object.values(e) as [T[keyof T], ...T[keyof T][]]);

export const PublicOptionSchema = z.object({
  id: z.string(),
  textAr: z.string(),
  textEn: z.string().optional(),
  mediaUrl: z.string().url().optional(),
});

/** Question as sent to clients — WITHOUT correctOptionId until reveal. */
export const PublicQuestionSchema = z.object({
  id: z.string(),
  type: zEnum(QuestionType),
  difficulty: zEnum(Difficulty),
  promptAr: z.string(),
  promptEn: z.string().optional(),
  promptMediaUrl: z.string().url().optional(),
  options: z.array(PublicOptionSchema).min(2).max(6),
  category: z
    .object({
      nameAr: z.string(),
      nameEn: z.string().optional(),
      color: z.string(),
      icon: z.string().optional(),
    })
    .optional(),
});
export type PublicQuestion = z.infer<typeof PublicQuestionSchema>;

export const PublicParticipantSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarId: z.string(),
  status: zEnum(ParticipantStatus),
  score: z.number().int(),
  lives: z.number().int(),
  teamId: z.string().optional(),
  /** Per-player-category mode: this player's chosen category id (if picked). */
  categoryId: z.string().optional(),
});
export type PublicParticipant = z.infer<typeof PublicParticipantSchema>;

export const TeamPublicSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  score: z.number().int(),
  /** Team lives — ELIMINATION mode only (0 = eliminated). */
  lives: z.number().int().optional(),
  /** Max players this team may hold (TEAMS games). */
  capacity: z.number().int().optional(),
  memberIds: z.array(z.string()),
});
export type TeamPublic = z.infer<typeof TeamPublicSchema>;

/**
 * The player who answered first-correct and earned the point for their team in
 * the most recently resolved round (TEAMS mode). Surfaced so clients can show
 * "أحمد أجاب أولاً وأحرز نقطة لفريق أ".
 */
export const RoundHeroSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  participantId: z.string(),
  nickname: z.string(),
  avatarId: z.string(),
  pointsAwarded: z.number().int(),
});
export type RoundHero = z.infer<typeof RoundHeroSchema>;

export const RankedEntrySchema = z.object({
  participantId: z.string(),
  nickname: z.string(),
  avatarId: z.string(),
  rank: z.number().int(),
  score: z.number().int(),
  delta: z.number().int(),
  /** Remaining lives — ELIMINATION mode (drives the hearts display). */
  lives: z.number().int(),
  status: zEnum(ParticipantStatus),
  teamId: z.string().optional(),
});
export type RankedEntry = z.infer<typeof RankedEntrySchema>;

export const SeenJeemSnapshotSchema = z.object({
  phase: zEnum(SeenJeemPhase),
  categories: z.array(
    z.object({
      categoryId: z.string(),
      nameAr: z.string(),
      nameEn: z.string().optional(),
      color: z.string(),
      icon: z.string().optional(),
      ownerTeamId: z.string().optional(),
    }),
  ),
  board: z.array(
    z.object({
      cellId: z.string(),
      categoryId: z.string(),
      points: z.number().int(),
      consumed: z.boolean(),
      awardedTeamId: z.string().optional(),
      awardedPoints: z.number().int().optional(),
    }),
  ),
  turnTeamId: z.string(),
  draftPickTeamId: z.string().optional(),
  lifelines: z.record(
    z.string(),
    z.object({
      CALL_FRIEND: z.boolean(),
      DISCARD: z.boolean(),
      DOUBLE: z.boolean(),
    }),
  ),
  active: z
    .object({
      cellId: z.string(),
      categoryId: z.string(),
      points: z.number().int(),
      doubled: z.boolean(),
      answeringTeamId: z.string(),
      removedOptionIds: z.array(z.string()),
      endsAt: z.number().int(),
      question: PublicQuestionSchema,
    })
    .optional(),
});
export type SeenJeemSnapshot = z.infer<typeof SeenJeemSnapshotSchema>;

export const RoomSnapshotSchema = z.object({
  game: z.object({
    id: z.string(),
    roomCode: z.string(),
    type: zEnum(GameType),
    mode: zEnum(GameMode),
    status: zEnum(GameStatus),
    round: z.number().int(),
    totalRounds: z.number().int(),
    /** Per-player-category mode: each player picks their own category in the lobby. */
    perPlayerCategory: z.boolean().optional(),
  }),
  participants: z.array(PublicParticipantSchema),
  teams: z.array(TeamPublicSchema).optional(),
  /** TEAMS mode: who earned each team's point in the last resolved round. */
  heroes: z.array(RoundHeroSchema).optional(),
  currentRound: z
    .object({
      roundId: z.string(),
      index: z.number().int(),
      question: PublicQuestionSchema,
      endsAt: z.number().int(), // epoch ms
      phase: zEnum(RoundPhase),
      answeredCount: z.number().int(),
    })
    .optional(),
  leaderboard: z.array(RankedEntrySchema),
  /** Present only on the /play namespace — the connected player's own view. */
  self: z
    .object({
      participantId: z.string(),
      status: zEnum(ParticipantStatus),
      score: z.number().int(),
      lives: z.number().int(),
      hasAnswered: z.boolean(),
    })
    .optional(),
  /** Present only in SEEN_JEEM mode. */
  seenJeem: SeenJeemSnapshotSchema.optional(),
});
export type RoomSnapshot = z.infer<typeof RoomSnapshotSchema>;

// ─────────────────────────── Client → Server payloads ───────────────────────

export const PlayerJoinSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(GAME_LIMITS.NICKNAME_MIN)
    .max(GAME_LIMITS.NICKNAME_MAX),
  avatarId: z.string().min(1),
  /** Optional player-account JWT — when present, the server links this
   *  participation to the account so wins/games-played accrue to the profile. */
  playerToken: z.string().min(1).optional(),
});
export type PlayerJoinInput = z.infer<typeof PlayerJoinSchema>;

export const PlayerAnswerSchema = z.object({
  roundId: z.string().min(1),
  optionId: z.string().min(1),
  clientTs: z.number().int().nonnegative(),
});
export type PlayerAnswerInput = z.infer<typeof PlayerAnswerSchema>;

/** TEAMS mode: a player claims a seat on a specific team in the lobby. */
export const PickTeamSchema = z.object({ teamId: z.string().min(1) });
export type PickTeamInput = z.infer<typeof PickTeamSchema>;

/** Per-player-category mode: a player picks their own category in the lobby. */
export const PickCategorySchema = z.object({ categoryId: z.string().min(1) });
export type PickCategoryInput = z.infer<typeof PickCategorySchema>;

export const PlayerKickSchema = z.object({ participantId: z.string().min(1) });
export const RoomTerminateSchema = z.object({ gameId: z.string().min(1) });
export const EmptySchema = z.object({}).strict();

/** Lookup table the server uses to validate inbound events generically. */
export const CLIENT_EVENT_SCHEMAS = {
  [ClientEvent.PLAYER_JOIN]: PlayerJoinSchema,
  [ClientEvent.PLAYER_PICK_TEAM]: PickTeamSchema,
  [ClientEvent.PLAYER_PICK_CATEGORY]: PickCategorySchema,
  [ClientEvent.PLAYER_ANSWER]: PlayerAnswerSchema,
  [ClientEvent.PLAYER_HEARTBEAT]: EmptySchema,
  [ClientEvent.PLAYER_RESYNC]: EmptySchema,
  [ClientEvent.TIME_SYNC]: EmptySchema,
  [ClientEvent.PLAYER_LEAVE]: EmptySchema,
  [ClientEvent.GAME_START]: EmptySchema,
  [ClientEvent.ROUND_NEXT]: EmptySchema,
  [ClientEvent.GAME_PAUSE]: EmptySchema,
  [ClientEvent.GAME_RESUME]: EmptySchema,
  [ClientEvent.PLAYER_KICK]: PlayerKickSchema,
  [ClientEvent.GAME_END]: EmptySchema,
  [ClientEvent.ADMIN_SUBSCRIBE]: EmptySchema,
  [ClientEvent.ADMIN_ROOM_TERMINATE]: RoomTerminateSchema,
  [ClientEvent.SJ_DRAFT_PICK]: DraftPickSchema,
  [ClientEvent.SJ_CELL_SELECT]: CellSelectSchema,
  [ClientEvent.SJ_LIFELINE_USE]: LifelineUseSchema,
  [ClientEvent.SJ_TEAM_ANSWER]: TeamAnswerSchema,
  [ClientEvent.SJ_ADJUDICATE]: AdjudicateSchema,
} as const;

// ─────────────────────────── Server → Client payloads ───────────────────────

export const PlayerJoinAckSchema = z.object({
  participantId: z.string(),
  sessionToken: z.string(),
});
export type PlayerJoinAck = z.infer<typeof PlayerJoinAckSchema>;

export const PlayerAnswerAckSchema = z.object({
  accepted: z.boolean(),
  lockedAt: z.number().int(),
});
export type PlayerAnswerAck = z.infer<typeof PlayerAnswerAckSchema>;

export interface QuestionShowPayload {
  round: number;
  roundId: string;
  question: PublicQuestion;
  endsAt: number;
  /**
   * When answering actually opens (after the 3-2-1 "get ready" pre-roll). Clients
   * show the countdown until this instant, then the live question + timer. Absent
   * on older servers → treat as "already started".
   */
  startsAt?: number;
  /** Per-player-category mode: whose category this round belongs to. */
  turnPlayer?: { nickname: string; avatarId: string };
  /** Sudden-death overtime question (shown after a tie). Clients label it
   *  "tie-breaker" instead of "round X of Y". */
  tiebreak?: boolean;
}

export interface TimerTickPayload {
  roundId: string;
  remainingMs: number;
}

export interface AnswerReceivedPayload {
  answeredCount: number;
  totalActive: number;
}

/** A player who answered correctly, with their podium place (1st/2nd/3rd…). */
export interface RevealAnswerer {
  participantId: string;
  nickname: string;
  avatarId: string;
  /** Podium place among correct answers (1 = fastest correct). */
  place: number;
}

export interface QuestionRevealPayload {
  roundId: string;
  correctOptionId: string;
  distribution: Record<string, number>;
  /** Fastest correct answers, ranked — drives the "1st / 2nd / 3rd" reveal. */
  topAnswerers?: RevealAnswerer[];
  explanationAr?: string;
  explanationEn?: string;
}

export interface AnswerResultPayload {
  roundId: string;
  isCorrect: boolean;
  pointsAwarded: number;
  newScore: number;
  livesLeft: number;
}

export interface ScoreUpdatePayload {
  leaderboard: RankedEntry[];
  /** TEAMS mode: refreshed team totals so the screen updates each round. */
  teams?: TeamPublic[];
}

export interface PlayerEliminatedPayload {
  participantIds: string[];
  round: number;
}

/** TEAMS mode: broadcast when a round's per-team winners are resolved. */
export interface TeamScoredPayload {
  roundIndex: number;
  heroes: RoundHero[];
}

export interface YouEliminatedPayload {
  finalRank: number;
  finalScore: number;
}

export interface RoundCompletedPayload {
  roundIndex: number;
  nextInMs?: number;
  /** The upcoming question's 1-based number (for "next: question X of Y"). */
  nextRound?: number;
  /** The upcoming question's category, so phones can preview what's next. */
  nextCategory?: { nameAr: string; nameEn?: string; color: string; icon?: string };
  /** The next question is a sudden-death tie-breaker (after an equal-score end). */
  tiebreak?: boolean;
}

export interface GameCompletedPayload {
  winner: PublicParticipant | null;
  winnerTeam: TeamPublic | null;
  /** TEAMS mode: every team with its final score + members (winner and losers). */
  teams?: TeamPublic[];
  finalLeaderboard: RankedEntry[];
  stats: { totalRounds: number; durationSec: number; totalPlayers: number };
}

// ───────────────────────── Seen-Jeem server payloads ────────────────────────

/** Full Seen-Jeem projection — sent on join/reconnect and after every mutation. */
export interface SeenJeemStatePayload {
  phase: SeenJeemPhase;
  categories: PublicSeenJeemCategory[];
  board: PublicBoardCell[];
  turnTeamId: string;
  draftPickTeamId?: string;
  lifelines: Record<string, PublicLifelineState>;
  active?: {
    cellId: string;
    categoryId: string;
    points: number;
    doubled: boolean;
    answeringTeamId: string;
    removedOptionIds: string[];
    endsAt: number;
    /** The open question (without correctOptionId until reveal). */
    question: PublicQuestion;
  };
}

export interface SjTurnChangedPayload {
  turnTeamId: string;
  phase: SeenJeemPhase;
}

export interface SjCellOpenedPayload {
  cellId: string;
  categoryId: string;
  points: number;
  answeringTeamId: string;
  question: PublicQuestion;
  endsAt: number;
}

export interface SjLifelineUsedPayload {
  teamId: string;
  lifeline: Lifeline;
  /** DISCARD: option ids removed. */
  removedOptionIds?: string[];
  /** CALL_FRIEND: the new deadline. */
  endsAt?: number;
  /** DOUBLE: the cell's stake is now doubled. */
  doubled?: boolean;
}

export interface SjCellResolvedPayload {
  cellId: string;
  correctOptionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean;
  answeringTeamId: string;
  pointsAwarded: number;
  teamScores: Record<string, number>;
  explanationAr?: string;
  explanationEn?: string;
}

/** Handshake auth payloads (Socket.IO `auth` field) per namespace. */
export interface ScreenAuth {
  hostToken: string;
  roomCode: string;
}
export interface PlayAuth {
  roomCode: string;
  sessionToken?: string;
}
export interface AdminAuth {
  accessToken: string;
}
