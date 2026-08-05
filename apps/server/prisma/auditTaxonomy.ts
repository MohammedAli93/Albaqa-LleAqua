/**
 * Dry-run of the content restructure: resolves every question-bank key through
 * BANK_ALIASES, applies the seed's answer-leak and duplicate filters, and reports the
 * bank size the seed would end up writing for each category — plus any bank key that
 * maps to nothing (whose content would be silently lost). Run:
 *   pnpm --filter @tahaddi/server exec tsx prisma/auditTaxonomy.ts
 */
import { QUESTION_BANK } from './questionBank.js';
import { CATEGORIES, GROUPS, BANK_ALIASES, TARGET_BANK_SIZE } from './taxonomy.js';
import { isAnswerLeak, normalizeAr } from './questionFilter.js';

const live = new Set(CATEGORIES.map((c) => c.slug));
const counts = new Map<string, number>();
const seen = new Set<string>();
const orphanKeys: string[] = [];
let leaks = 0;
let dupes = 0;

for (const [key, qs] of Object.entries(QUESTION_BANK)) {
  const slug = BANK_ALIASES[key] ?? key;
  if (!live.has(slug)) {
    orphanKeys.push(`${key} → ${slug}`);
    continue;
  }
  for (const q of qs) {
    if (isAnswerLeak(q.ar, q.o[q.c] ?? '')) {
      leaks++;
      continue;
    }
    const n = normalizeAr(q.ar);
    if (seen.has(n)) {
      dupes++;
      continue;
    }
    seen.add(n);
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
}

const seeded = [...counts.values()].reduce((a, b) => a + b, 0);
console.log(`bank keys ${Object.keys(QUESTION_BANK).length} · categories ${CATEGORIES.length} · groups ${GROUPS.length}`);
console.log(`would seed ${seeded} questions (dropped: ${leaks} answer-leaks, ${dupes} duplicates)`);
if (orphanKeys.length) console.log('⚠️  bank keys mapping to nothing:', orphanKeys);

for (const g of GROUPS) {
  const cats = CATEGORIES.filter((c) => c.group === g.slug);
  const total = cats.reduce((n, c) => n + (counts.get(c.slug) ?? 0), 0);
  console.log(`\n${g.nameAr} — ${total}`);
  for (const c of cats) {
    const n = counts.get(c.slug) ?? 0;
    console.log(`  ${n === 0 ? '!!' : '  '} ${String(n).padStart(4)} / ${TARGET_BANK_SIZE}  ${c.slug.padEnd(24)} ${c.nameAr}`);
  }
}
