/**
 * Static trivia question bank — the source of truth for gameplay content.
 * Seeded into the database (see seed.ts); the apps retrieve questions from the DB
 * at runtime. No AI / no API key is involved in serving these.
 *
 * The bank used to live in this one file. The client's brief (2026-08-05) is 500
 * questions per category — ~30,000 rows — so it now lives one file per category under
 * `prisma/bank/`, keyed by category slug. **To add questions, edit that category's
 * file** (e.g. `prisma/bank/what-similar.ts`); this module just re-exports the
 * assembled bank so every existing importer keeps working.
 *
 * Rules every question must satisfy (enforced by `prisma/validateBank.ts`):
 *   • the prompt must not spell out its own answer;
 *   • the four options must be the same kind of thing — no filler answers;
 *   • no duplicate prompt anywhere in the bank, not even across categories.
 */
export type { Difficulty, BankQuestion } from './bank/types.js';
export { QUESTION_BANK } from './bank/index.js';
