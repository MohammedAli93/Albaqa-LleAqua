/**
 * Bank refiler — moves questions between category files and drops redundant ones,
 * from an explicit plan in `refilePlan.ts`.
 *
 * Why a tool and not a hand-edit: the client's 2026-09-01 review was, at heart, one
 * complaint repeated twelve times — «عدم دقة تصنيف بعض الأسئلة داخل الفئات». Gulf
 * bread, men's dress, the Taif rose and the King Faisal Prize were all being asked
 * under «الفن الخليجي»; a national anthem, the Prado and the Jerash festival under
 * «فنانون عرب وأجانب». None of those questions is wrong — every one of them is
 * simply filed under a category that promised the player something else. The fix is
 * therefore a *move*, not a rewrite, and moving ~200 one-line records across a dozen
 * files by hand is exactly the kind of edit that loses three of them.
 *
 * Every question in `bank/*.ts` occupies exactly one line beginning `  { ar:`, which
 * is what makes a line-level move safe and reviewable: the moved line is byte-identical
 * in its new home, so `git diff` shows a deletion here and an insertion there and
 * nothing else. Section comments sit between question lines and are left where they
 * are — `qAt` maps a plan index to its body line so comments never shift it.
 *
 * Run:
 *   pnpm --filter @tahaddi/server exec tsx prisma/refileBank.ts --dry   # print, change nothing
 *   pnpm --filter @tahaddi/server exec tsx prisma/refileBank.ts         # apply
 *
 * The plan addresses questions by ARRAY INDEX, resolved against the bank as it is
 * when the run starts, and every move, drop and edit is applied in ONE pass — so
 * indices never shift underneath the plan. A plan is therefore good for exactly one
 * run: re-running it after it has been applied would move the wrong rows. Re-derive
 * the indices before writing a new one.
 *
 * Afterwards, always: `pnpm bank:validate` then `pnpm bank:fit`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTION_BANK } from './questionBank.js';
import { MOVES, MOVES_BY_PROMPT, DROPS, EDITS } from './refilePlan.js';

const BANK_DIR = join(dirname(fileURLToPath(import.meta.url)), 'bank');
const DRY = process.argv.includes('--dry');
const fileFor = (slug: string) => join(BANK_DIR, `${slug}.ts`);
const isQuestion = (line: string) => line.startsWith('  { ar:');

/**
 * A bank file split into: everything before the first question, the body (question
 * lines and the section comments interleaved with them) and everything after the
 * last question. `qAt[i]` is the body position of the i-th question.
 */
interface Parsed {
  head: string[];
  body: string[];
  qAt: number[];
  tail: string[];
}

function parse(slug: string): Parsed {
  const raw = readFileSync(fileFor(slug), 'utf8').split(/\r?\n/);
  const first = raw.findIndex(isQuestion);
  if (first < 0) throw new Error(`${slug}: no question lines found`);
  let last = first;
  for (let i = first; i < raw.length; i++) if (isQuestion(raw[i]!)) last = i;
  const body = raw.slice(first, last + 1);
  const qAt: number[] = [];
  body.forEach((l, i) => { if (isQuestion(l)) qAt.push(i); });
  return { head: raw.slice(0, first), body, qAt, tail: raw.slice(last + 1) };
}

function write(slug: string, p: Parsed): void {
  if (!DRY) writeFileSync(fileFor(slug), [...p.head, ...p.body, ...p.tail].join('\n'), 'utf8');
}

// ── Load every file the plan touches, and check it against the compiled bank ──
const parsed = new Map<string, Parsed>();
const touched = new Set<string>([
  ...Object.keys(MOVES),
  ...Object.values(MOVES).flatMap((m) => Object.keys(m)),
  ...Object.keys(MOVES_BY_PROMPT),
  ...Object.values(MOVES_BY_PROMPT).flatMap((m) => Object.keys(m)),
  ...Object.keys(DROPS),
  ...Object.keys(EDITS),
]);
for (const slug of touched) {
  const p = parse(slug);
  const expected = QUESTION_BANK[slug]?.length ?? -1;
  if (p.qAt.length !== expected) {
    throw new Error(`${slug}: parsed ${p.qAt.length} questions but the bank holds ${expected} — refusing to edit`);
  }
  parsed.set(slug, p);
}

// ── Collect what leaves each file, then append it to its destination ──────────
let moved = 0;
let dropped = 0;
let edited = 0;
const removals = new Map<string, Set<number>>();
const additions = new Map<string, string[]>();
const claim = (slug: string, i: number) => {
  const set = removals.get(slug) ?? new Set<number>();
  if (set.has(i)) throw new Error(`${slug}[${i}] is claimed twice by the plan`);
  set.add(i);
  removals.set(slug, set);
};
const add = (slug: string, line: string) => {
  const list = additions.get(slug) ?? [];
  list.push(line);
  additions.set(slug, list);
};

for (const [from, byDest] of Object.entries(MOVES)) {
  const src = parsed.get(from)!;
  for (const [to, indices] of Object.entries(byDest)) {
    for (const i of indices) {
      const at = src.qAt[i];
      if (at === undefined) throw new Error(`${from}[${i}] is out of range`);
      claim(from, i);
      add(to, src.body[at]!);
      moved++;
      console.log(`  → ${from} → ${to}: ${QUESTION_BANK[from]![i]!.ar}`);
    }
  }
}

/**
 * The same as MOVES but keyed on the Arabic prompt instead of an array index.
 * Prefer this shape for new plans: a prompt survives an earlier pass reordering the
 * file, so a prompt-keyed plan can be re-read (and re-reviewed) long after it ran.
 */
for (const [from, byDest] of Object.entries(MOVES_BY_PROMPT)) {
  const src = parsed.get(from)!;
  for (const [to, prompts] of Object.entries(byDest)) {
    for (const prompt of prompts) {
      const i = QUESTION_BANK[from]!.findIndex((q) => q.ar === prompt);
      if (i < 0) throw new Error(`${from}: no question with prompt "${prompt}"`);
      claim(from, i);
      add(to, src.body[src.qAt[i]!]!);
      moved++;
      console.log(`  → ${from} → ${to}: ${prompt}`);
    }
  }
}

for (const [slug, indices] of Object.entries(DROPS)) {
  const p = parsed.get(slug)!;
  for (const i of indices) {
    if (p.qAt[i] === undefined) throw new Error(`${slug}[${i}] is out of range`);
    claim(slug, i);
    dropped++;
    console.log(`  ✗ ${slug}: ${QUESTION_BANK[slug]![i]!.ar}`);
  }
}

// ── Whole-line replacements (rewordings) ─────────────────────────────────────
for (const [slug, byIndex] of Object.entries(EDITS)) {
  const p = parsed.get(slug)!;
  for (const [idx, line] of Object.entries(byIndex)) {
    const i = Number(idx);
    const at = p.qAt[i];
    if (at === undefined) throw new Error(`${slug}[${i}] is out of range`);
    if (removals.get(slug)?.has(i)) throw new Error(`${slug}[${i}] is both edited and removed`);
    console.log(`  ✎ ${slug}: ${QUESTION_BANK[slug]![i]!.ar}`);
    p.body[at] = line;
    edited++;
  }
}

// ── Apply ────────────────────────────────────────────────────────────────────
const BANNER = '  // ── منقول إليها 2026-09-01: تصحيح تصنيف الأسئلة (ملاحظات العميل) ──';
for (const [slug, p] of parsed) {
  const dropLines = new Set([...(removals.get(slug) ?? [])].map((i) => p.qAt[i]!));
  const kept = p.body.filter((_, i) => !dropLines.has(i));
  const incoming = additions.get(slug) ?? [];
  p.body = incoming.length ? [...kept, BANNER, ...incoming] : kept;
  p.qAt = [];
  p.body.forEach((l, i) => { if (isQuestion(l)) p.qAt.push(i); });
  write(slug, p);
}

const width = Math.max(...[...parsed.keys()].map((s) => s.length));
console.log('');
for (const [slug, p] of [...parsed].sort()) {
  const before = QUESTION_BANK[slug]!.length;
  const after = p.qAt.length;
  const delta = after - before;
  console.log(`  ${slug.padEnd(width)}  ${String(before).padStart(4)} → ${String(after).padStart(4)}  ${delta > 0 ? `+${delta}` : delta}`);
}
console.log(`\n${DRY ? 'DRY RUN — ' : ''}${moved} moved · ${dropped} dropped · ${edited} reworded`);
