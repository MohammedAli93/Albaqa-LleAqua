/**
 * One-off audit: report which bank questions the seed-time answer-leak filter
 * (questionFilter.ts) will DROP, and the per-category impact. Run:
 *   pnpm --filter @tahaddi/server exec tsx prisma/auditLeaks.ts
 */
import { QUESTION_BANK } from './questionBank.js';
import { isAnswerLeak } from './questionFilter.js';

let total = 0;
let dropped = 0;
const perCat: { slug: string; total: number; drop: number; samples: string[] }[] = [];

for (const [slug, qs] of Object.entries(QUESTION_BANK)) {
  let drop = 0;
  const samples: string[] = [];
  for (const q of qs) {
    total++;
    if (isAnswerLeak(q.ar, q.o[q.c] ?? '')) {
      drop++;
      dropped++;
      samples.push(`${q.ar}  ✓ ${q.o[q.c]}`);
    }
  }
  if (drop > 0) perCat.push({ slug, total: qs.length, drop, samples });
}

perCat.sort((a, b) => b.drop - a.drop);

console.log(`\nTotal questions: ${total}  →  drop ${dropped}  →  keep ${total - dropped}\n`);
console.log('Per-category impact (kept / original):');
for (const c of perCat) {
  console.log(`  ${c.slug.padEnd(20)} drop ${String(c.drop).padStart(2)}  →  keeps ${c.total - c.drop}/${c.total}`);
}
console.log('\nDropped questions:');
for (const c of perCat) {
  console.log(`\n[${c.slug}]`);
  for (const s of c.samples) console.log(`   • ${s}`);
}
