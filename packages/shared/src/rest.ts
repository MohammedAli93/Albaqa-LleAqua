/**
 * REST DTOs & Zod schemas (doc 04). Shared where the shape is shared between
 * client and server (auth, room creation, content). The server re-uses these in
 * its `validate()` middleware; clients use the inferred types for fetch calls.
 */
import { z } from 'zod';
import {
  GameType,
  GameMode,
  QuestionType,
  Difficulty,
  GAME_LIMITS,
} from './domain.js';

const zEnum = <T extends Record<string, string>>(e: T) =>
  z.enum(Object.values(e) as [T[keyof T], ...T[keyof T][]]);

// ──────────────────────────────────── Auth ──────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8).max(200),
});

// ────────────────────────── Player accounts (registration) ──────────────────
// Players register with username + email + mobile (all required & validated).
// No OTP/password — mobile is the unique identity used to log back in.

/** International mobile number: optional leading +, 8–15 digits. */
export const MOBILE_REGEX = /^\+?[0-9]{8,15}$/;
export const USERNAME_REGEX = /^[\p{L}\p{N}_ .-]{2,24}$/u;

const usernameField = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .regex(USERNAME_REGEX, 'اسم مستخدم غير صالح');
const emailField = z.string().trim().toLowerCase().email('بريد إلكتروني غير صالح');
const mobileField = z
  .string()
  .trim()
  .regex(MOBILE_REGEX, 'رقم جوال غير صالح');

export const PlayerRegisterSchema = z.object({
  username: usernameField,
  email: emailField,
  mobile: mobileField,
  country: z.string().trim().min(2).max(3).optional(),
  avatarId: z.string().min(1).optional(),
});
export type PlayerRegisterInput = z.infer<typeof PlayerRegisterSchema>;

/** Returning players log in by their registered mobile number. */
export const PlayerLoginSchema = z.object({
  mobile: mobileField,
});
export type PlayerLoginInput = z.infer<typeof PlayerLoginSchema>;

export const PlayerUpdateSchema = z.object({
  username: usernameField.optional(),
  email: emailField.optional(),
  country: z.string().trim().min(2).max(3).optional(),
  avatarId: z.string().min(1).optional(),
});
export type PlayerUpdateInput = z.infer<typeof PlayerUpdateSchema>;

/** Player profile as returned by the API (never includes internal fields). */
export interface PlayerProfile {
  id: string;
  username: string;
  email: string;
  mobile: string;
  country: string | null;
  avatarId: string;
  pointsWins: number;
  eliminationWins: number;
  gamesPlayed: number;
}

export interface PlayerAuthResponse {
  token: string;
  player: PlayerProfile;
  isNew: boolean;
}

// ─────────────────────────────── Game settings ──────────────────────────────

export const GameSettingsSchema = z
  .object({
    type: zEnum(GameType),
    mode: zEnum(GameMode),
    maxPlayers: z
      .number()
      .int()
      .min(GAME_LIMITS.MIN_PLAYERS)
      .max(GAME_LIMITS.MAX_PLAYERS),
    minPlayers: z.number().int().min(GAME_LIMITS.MIN_PLAYERS),
    questionTimerSec: z
      .number()
      .int()
      .min(GAME_LIMITS.MIN_TIMER_SEC)
      .max(GAME_LIMITS.MAX_TIMER_SEC),
    livesPerPlayer: z
      .number()
      .int()
      .min(GAME_LIMITS.MIN_LIVES)
      .max(GAME_LIMITS.MAX_LIVES),
    speedBonus: z.boolean(),
    intermissionSec: z.number().int().min(0).max(30),
    autoAdvance: z.boolean(),
    totalRounds: z.number().int().min(1).max(100).nullable(),
    teamCount: z
      .number()
      .int()
      .min(GAME_LIMITS.MIN_TEAMS)
      .max(GAME_LIMITS.MAX_TEAMS)
      .optional(),
    playersPerTeam: z
      .number()
      .int()
      .min(GAME_LIMITS.MIN_PLAYERS_PER_TEAM)
      .max(GAME_LIMITS.MAX_PLAYERS_PER_TEAM)
      .optional(),
    firstTeamId: z.string().nullable().optional(),
    scoringMode: z.enum(['SPEED', 'PLACEMENT']).optional(),
    tournamentName: z.string().max(120).optional(),
  })
  .refine((s) => s.minPlayers <= s.maxPlayers, {
    message: 'minPlayers must be <= maxPlayers',
    path: ['minPlayers'],
  })
  .refine((s) => s.type !== GameType.TEAMS || (s.teamCount ?? 0) >= GAME_LIMITS.MIN_TEAMS, {
    message: 'teamCount is required for TEAMS games',
    path: ['teamCount'],
  })
  .refine(
    (s) => s.type !== GameType.TEAMS || (s.playersPerTeam ?? 0) >= GAME_LIMITS.MIN_PLAYERS_PER_TEAM,
    { message: 'playersPerTeam is required for TEAMS games', path: ['playersPerTeam'] },
  );

export const CreateRoomSchema = z.object({
  packageId: z.string().uuid(),
  settings: GameSettingsSchema,
});
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;

export interface CreateRoomResponse {
  gameId: string;
  roomCode: string;
  hostToken: string;
  socketUrl: string;
}

export interface RoomLobbyInfo {
  exists: boolean;
  status: string;
  type: GameType;
  mode: GameMode;
  playerCount: number;
  maxPlayers: number;
  packageTitleAr: string;
  packageTitleEn?: string;
}

// ──────────────────────────────── Content DTOs ──────────────────────────────

export const OptionInputSchema = z.object({
  id: z.string().min(1),
  textAr: z.string().min(1),
  textEn: z.string().optional(),
  mediaId: z.string().uuid().optional(),
});

/** Base object (used for `.partial()` on PATCH). */
export const QuestionBaseSchema = z.object({
  type: zEnum(QuestionType),
  difficulty: zEnum(Difficulty),
  categoryId: z.string().uuid(),
  promptAr: z.string().min(1).max(500),
  promptEn: z.string().max(500).optional(),
  explanationAr: z.string().max(1000).optional(),
  explanationEn: z.string().max(1000).optional(),
  options: z.array(OptionInputSchema).min(2).max(6),
  correctOptionId: z.string().min(1),
  timeLimitSec: z
    .number()
    .int()
    .min(GAME_LIMITS.MIN_TIMER_SEC)
    .max(GAME_LIMITS.MAX_TIMER_SEC)
    .default(15),
  basePoints: z.number().int().min(10).max(10000).default(100),
  speedBonus: z.boolean().default(true),
  promptMediaId: z.string().uuid().optional(),
  tags: z.array(z.string()).max(20).default([]),
});

/** Full create schema with the cross-field invariant. */
export const QuestionInputSchema = QuestionBaseSchema.refine(
  (q) => q.options.some((o) => o.id === q.correctOptionId),
  { message: 'correctOptionId must reference one of the options', path: ['correctOptionId'] },
);
export type QuestionInput = z.infer<typeof QuestionInputSchema>;

export const CategoryInputSchema = z.object({
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  nameAr: z.string().min(1).max(80),
  nameEn: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#7C3AED'),
  icon: z.string().max(40).optional(),
  sortOrder: z.number().int().default(0),
});

export const PackageInputSchema = z.object({
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  titleAr: z.string().min(1).max(120),
  titleEn: z.string().max(120).optional(),
  descAr: z.string().max(1000).optional(),
  descEn: z.string().max(1000).optional(),
  coverMediaId: z.string().uuid().optional(),
  isPremium: z.boolean().default(false),
  priceMinor: z.number().int().min(0).default(0),
  currency: z.string().length(3).default('SAR'),
});

export const PackageQuestionsSchema = z.object({
  questions: z
    .array(z.object({ questionId: z.string().uuid(), order: z.number().int() }))
    .max(200),
});

// ──────────────────────────────────── Media ─────────────────────────────────

export const SignUploadSchema = z.object({
  type: z.enum(['IMAGE', 'AUDIO', 'VIDEO']),
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.number().int().positive(),
});
export type SignUploadInput = z.infer<typeof SignUploadSchema>;

export interface SignUploadResponse {
  mediaId: string;
  uploadUrl: string;
  storageKey: string;
  publicUrl: string;
}

/** Allowed mime types + size caps per media type (bytes). */
export const MEDIA_RULES = {
  IMAGE: {
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxBytes: 8 * 1024 * 1024,
  },
  AUDIO: {
    mimes: ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'],
    maxBytes: 20 * 1024 * 1024,
  },
  VIDEO: {
    mimes: ['video/mp4', 'video/webm'],
    maxBytes: 200 * 1024 * 1024,
  },
} as const;

// ──────────────────────────────── Pagination ────────────────────────────────

export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// ──────────────────────────────── Payments ──────────────────────────────────

export const CheckoutSchema = z.object({
  packageId: z.string().uuid(),
  provider: z.enum(['STRIPE', 'PAYMOB', 'MADA', 'FAWRY', 'APPLE_PAY', 'GOOGLE_PAY']),
});
export type CheckoutInput = z.infer<typeof CheckoutSchema>;
