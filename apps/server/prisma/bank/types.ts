/**
 * Shape of one bank question. Kept deliberately compact — a category file holds up
 * to 500 of these, so every character of ceremony is paid for 500 times over.
 *
 *   ar — Arabic prompt (what players read). Must NOT contain the correct answer.
 *   en — short English prompt (used by the admin panel and the English locale).
 *   o  — answer options in Arabic. Always 4, always the same kind of thing as each
 *        other: four capitals, four years, four players — never three real answers
 *        and a joke (client's rule, 2026-08-05).
 *   c  — index of the correct option in `o`.
 *   d  — difficulty; MEDIUM when omitted. HARD stays a minority of each bank.
 */
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface BankQuestion {
  ar: string;
  en: string;
  o: string[];
  c: number;
  d?: Difficulty;
}
