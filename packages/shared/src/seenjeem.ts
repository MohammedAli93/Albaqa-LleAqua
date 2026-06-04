/**
 * Seen-Jeem mode — the turn-based board format (category draft + lifelines).
 *
 * This is the wire vocabulary for the مود سين جيم: a board of 6 categories that
 * two teams draft (3 each), then take turns opening point-valued cells and
 * answering, spending three one-shot lifelines along the way. It is deliberately
 * a *separate* contract from the simultaneous-answer elimination mode — the two
 * formats share teams/participants but not their round model.
 */
import { z } from 'zod';
import type { Difficulty } from './domain.js';

// ─────────────────────────────────── Enums ──────────────────────────────────

/** Sub-phase while a SEEN_JEEM game is ACTIVE (parallels RoundPhase). */
export const SeenJeemPhase = {
  DRAFT: 'DRAFT', // teams alternately claim categories until 3 each
  SELECT: 'SELECT', // the team on turn picks a cell from its board
  ANSWERING: 'ANSWERING', // a cell is open, the team is answering
  REVEAL: 'REVEAL', // correct answer disclosed, points settled
  COMPLETE: 'COMPLETE', // all cells consumed
} as const;
export type SeenJeemPhase = (typeof SeenJeemPhase)[keyof typeof SeenJeemPhase];

/** The three one-shot social lifelines (وسائل المساعدة) — one use each per team. */
export const Lifeline = {
  CALL_FRIEND: 'CALL_FRIEND', // اتصال بصديق — extend the answer window
  DISCARD: 'DISCARD', // حذف — remove two wrong options (50:50-style)
  DOUBLE: 'DOUBLE', // دبل — wager: a correct answer scores double
} as const;
export type Lifeline = (typeof Lifeline)[keyof typeof Lifeline];

export const ALL_LIFELINES = [
  Lifeline.CALL_FRIEND,
  Lifeline.DISCARD,
  Lifeline.DOUBLE,
] as const;

// ───────────────────────────────── Constants ────────────────────────────────

export const SEEN_JEEM = {
  CATEGORIES_ON_BOARD: 6,
  CATEGORIES_PER_TEAM: 3,
  TEAMS: 2,
  /** Cells per owned category → 6 cells × 3 categories = 18 per team, 36 total. */
  CELLS_PER_CATEGORY: 6,
  /** Each tier appears twice within a category. */
  POINT_TIERS: [200, 400, 600] as const,
  CALL_FRIEND_EXTRA_SEC: 30,
  DISCARD_REMOVES: 2,
  DOUBLE_MULTIPLIER: 2,
  ANSWER_TIMER_SEC: 45,
} as const;

/** Difficulty → cell point value, used to tier a category's questions. */
export const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  EASY: 200,
  MEDIUM: 400,
  HARD: 600,
  EXPERT: 600,
};

// ─────────────────────────── Public projection types ────────────────────────
// What clients see. Note: questionId / correctOptionId are SERVER-ONLY and never
// appear here — the open question travels in the dedicated CELL_OPENED event.

export interface PublicSeenJeemCategory {
  categoryId: string;
  nameAr: string;
  nameEn?: string;
  color: string;
  icon?: string;
  /** Set once drafted. */
  ownerTeamId?: string;
}

export interface PublicBoardCell {
  cellId: string;
  categoryId: string;
  points: number;
  consumed: boolean;
  awardedTeamId?: string;
  awardedPoints?: number;
}

/** Per-team lifeline availability — `true` means still unused. */
export interface PublicLifelineState {
  CALL_FRIEND: boolean;
  DISCARD: boolean;
  DOUBLE: boolean;
}

/** The currently open cell (without the question payload — that's in CELL_OPENED). */
export interface PublicActiveCell {
  cellId: string;
  categoryId: string;
  points: number;
  doubled: boolean;
  answeringTeamId: string;
  removedOptionIds: string[];
  endsAt: number; // epoch ms
}

export interface PublicSeenJeemState {
  phase: SeenJeemPhase;
  categories: PublicSeenJeemCategory[];
  /** Owned-category cells; empty during DRAFT. */
  board: PublicBoardCell[];
  /** Whose turn it is to pick a cell (SELECT) or who is answering (ANSWERING). */
  turnTeamId: string;
  /** During DRAFT, whose pick it is. */
  draftPickTeamId?: string;
  /** teamId → lifeline availability. */
  lifelines: Record<string, PublicLifelineState>;
  active?: PublicActiveCell;
}

// ──────────────────────── Client → Server intent schemas ────────────────────

export const DraftPickSchema = z.object({ categoryId: z.string().min(1) });
export type DraftPickInput = z.infer<typeof DraftPickSchema>;

export const CellSelectSchema = z.object({ cellId: z.string().min(1) });
export type CellSelectInput = z.infer<typeof CellSelectSchema>;

export const LifelineUseSchema = z.object({
  lifeline: z.enum(ALL_LIFELINES as unknown as [Lifeline, ...Lifeline[]]),
});
export type LifelineUseInput = z.infer<typeof LifelineUseSchema>;

export const TeamAnswerSchema = z.object({
  cellId: z.string().min(1),
  optionId: z.string().min(1),
});
export type TeamAnswerInput = z.infer<typeof TeamAnswerSchema>;

/** Host arbitration for open/spoken answers (accept / reject). */
export const AdjudicateSchema = z.object({
  cellId: z.string().min(1),
  correct: z.boolean(),
});
export type AdjudicateInput = z.infer<typeof AdjudicateSchema>;
