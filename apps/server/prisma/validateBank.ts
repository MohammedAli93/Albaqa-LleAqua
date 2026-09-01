/**
 * Gate for every question written into prisma/bank/. Run after each batch:
 *   pnpm --filter @tahaddi/server exec tsx prisma/validateBank.ts
 *   …and `--fill` to print only the progress table toward 500/category.
 *
 * Checks, in the client's words (2026-08-05):
 *   «اسئلة صياغتها سليمة ولا تحتوي على الاجابة»  → prompt must not contain its answer
 *   «والخيارات لا تكون بديهية»                    → four same-kind options, no filler
 *
 * Mechanical rules:
 *   1. exactly 4 options, all non-empty and distinct (a repeated option is a free
 *      elimination for the player);
 *   2. `c` in range;
 *   3. the prompt does not spell out the correct answer (seed-time filter — a question
 *      that trips it is silently dropped, so it must never reach the bank);
 *   4. no duplicate prompt anywhere in the bank, across categories too — the same
 *      question showing up twice in a game is the client's oldest complaint;
 *   5. options are of one kind: all numeric or all textual, and no option wildly
 *      shorter/longer than the rest (the «الفول» case from the client's bad example);
 *   6. HARD stays ≤ 25% of a category (client 2026-07-28: difficulty sits at medium);
 *   7. the prompt is a question — ends with ؟ or ?.
 */
import { QUESTION_BANK } from './questionBank.js';
import { CATEGORIES, TARGET_BANK_SIZE } from './taxonomy.js';
import { isAnswerLeak, normalizeAr } from './questionFilter.js';

interface Problem { slug: string; prompt: string; issue: string }

const problems: Problem[] = [];
const seen = new Map<string, string>(); // normalized prompt → category that used it

/**
 * The word or phrase a prompt quotes in «guillemets» — the subject of the question.
 * Exact-prompt de-duplication misses near-repeats: «عقب» and «عقب» في اللهجة الخليجية
 * are two strings but one question to a player, and questions that feel repeated are
 * the client's oldest complaint.
 *
 * Keyed on term + correct answer, not the term alone: asking who starred in «العاصوف»
 * and which era it covers are two legitimate questions about one show, whereas two
 * questions about «عقب» that both answer «بعد» are the same question written twice.
 */
const quoted = (s: string): string | null => {
  const m = s.match(/«([^»]+)»/);
  return m ? normalizeAr(m[1]!) : null;
};
const seenQuoted = new Map<string, string>(); // category → first prompt quoting this term

/**
 * Content words of a prompt: everything except the interrogative scaffolding that
 * every prompt in the bank shares. Without stripping those, "ما اسم … ؟" alone gives
 * two unrelated questions a head start toward looking similar.
 */
const STOP = new Set(['ما', 'من', 'هو', 'هي', 'اسم', 'التي', 'الذي', 'في', 'علي', 'الي',
  'اي', 'كم', 'متي', 'اين', 'كيف', 'لماذا', 'هل', 'عن', 'مع', 'الي', 'هذا', 'هذه',
  'يسمي', 'تسمي', 'تعني', 'يعني', 'ماذا', 'كان', 'كانت', 'و', 'او', 'ثم', 'قد', 'بـ']);
/**
 * Strip the clitics Arabic glues onto the front of a word, so the comparison sees
 * the word and not the sentence position it happened to sit in.
 *
 * This is the whole reason «من الثنائي الذي لحّن وكتب معظم أعمال فيروز؟» and «من
 * الثنائي الذي كتب ولحّن معظم أعمال فيروز؟» sat in the bank as two questions with
 * one answer until the client found them (2026-09-01): «وكتب» and «كتب» are the same
 * word, and an unstemmed comparison called them different, which broke the subset
 * test that would otherwise have matched the two prompts exactly.
 *
 * Deliberately shallow — a leading و/ف, the definite article, and بـ/لـ/كـ before it.
 * Anything deeper needs a morphological analyser, and a wrong stem invents duplicates
 * that aren't there.
 */
const stem = (w: string): string => {
  let x = w;
  if (x.length > 3 && (x[0] === 'و' || x[0] === 'ف')) x = x.slice(1);
  if (x.length > 4 && (x[0] === 'ب' || x[0] === 'ل' || x[0] === 'ك') && x.startsWith(x[0] + 'ال')) x = x.slice(3);
  else if (x.length > 4 && x.startsWith('ال')) x = x.slice(2);
  return x;
};
const contentWords = (s: string): Set<string> =>
  new Set(
    normalizeAr(s)
      .split(' ')
      .map(stem)
      .filter((w) => w.length > 1 && !STOP.has(w) && !STOP.has(`ال${w}`)),
  );

/**
 * Decorative words that do not change what a question asks. Stripped before comparing,
 * so «ما أطول سورة في القرآن؟» and «ما أطول سورة في القرآن الكريم؟» compare equal.
 */
const DECOR = new Set(['الكريم', 'الشريف', 'تعالي', 'المباركه', 'العظيم', 'الشهير',
  'المشهور', 'المعروف', 'الكبير', 'عام', 'سنه', 'دوله', 'مدينه', 'الحالي', 'حاليا']);

/**
 * Two prompts ask the same question when, after decoration is stripped, one's content
 * words are a subset of the other's. Deliberately NOT a similarity threshold: a
 * threshold cannot tell «أين ذُكرت غزوة تبوك؟» from «أين ذُكرت غزوة حنين؟» — both
 * answer سورة التوبة and differ by exactly one word, but they are two real questions.
 * A subset means one prompt adds detail and asks nothing new; that is a duplicate.
 */
const asksTheSame = (a: Set<string>, b: Set<string>): boolean => {
  const A = [...a].filter((w) => !DECOR.has(w));
  const B = [...b].filter((w) => !DECOR.has(w));
  if (!A.length || !B.length) return false;
  return A.every((w) => b.has(w)) || B.every((w) => a.has(w));
};

/** category+answer → prompts already using it, for the near-duplicate check. */
const byAnswer = new Map<string, { prompt: string; words: Set<string> }[]>();

/**
 * Topic coherence. A category is a promise about what the player will be asked:
 * pick «الرياضة» and every question should be about sport. Bulk intake can break
 * that promise silently — a religion question landing in a football bank reads as
 * a bug to the player even though the question itself is perfectly good.
 *
 * Each entry is a group of categories plus the words that mean "this text belongs
 * to that group". A question is flagged when it carries another group's marker and
 * none of its own. Deliberately loose: it only fires on strong, unambiguous markers,
 * because the cost of a false positive (deleting a good question) is real.
 */
const TOPIC_MARKERS: { slugs: string[]; words: string[] }[] = [
  {
    slugs: ['quran', 'prophets-companions', 'islamic-history'],
    words: ['سورة', 'الآية', 'القرآن', 'الرسول', 'النبي', 'الصحابي', 'الصحابة', 'الخليفة',
            'الصلاة', 'الزكاة', 'الحج', 'الصيام', 'رمضان', 'الحديث النبوي', 'غزوة', 'الأنبياء'],
  },
  {
    slugs: ['world-cup', 'football-europe', 'football-asia', 'football-africa',
            'football-southamerica', 'football-arab', 'football-gulf', 'saudi-league',
            'premier-league', 'laliga'],
    words: ['كرة القدم', 'المنتخب', 'الدوري', 'الهدف', 'المرمى', 'اللاعب', 'الملعب',
            'كأس العالم', 'البطولة', 'المباراة', 'النادي'],
  },
  {
    slugs: ['medicine-health'],
    words: ['المرض', 'الدواء', 'الطبيب', 'العلاج', 'فيتامين', 'الجراحة', 'اللقاح'],
  },
];
const groupOf = new Map<string, number>();
TOPIC_MARKERS.forEach((g, i) => g.slugs.forEach((s) => groupOf.set(s, i)));

/**
 * Categories that are cross-topic by design — comparing a prophet to a footballer is
 * the entire point of «ما المتشابه؟», and الثقافة العامة is general knowledge. The
 * coherence check does not apply to them.
 */
const CROSS_TOPIC = new Set([
  'what-similar', 'what-different', 'general', 'guess', 'weird-facts', 'puzzles-logic',
]);

/** How many of a group's markers a text carries (whole-word, so «السردين» doesn't
 *  trip a marker it merely contains). */
const markerHits = (text: string, i: number) => {
  const padded = ` ${text.replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  return TOPIC_MARKERS[i]!.words.filter((w) => padded.includes(` ${w} `)).length;
};
const fill: { slug: string; nameAr: string; n: number; hard: number }[] = [];

const isNumeric = (s: string) => /^[\d٠-٩.,\s%+-]+$/.test(s.trim());

for (const cat of CATEGORIES) {
  const questions = QUESTION_BANK[cat.slug] ?? [];
  let hard = 0;
  for (const q of questions) {
    const at = (issue: string) => problems.push({ slug: cat.slug, prompt: q.ar, issue });
    if (q.d === 'HARD') hard++;

    // Four options, except صح/خطأ questions — a true/false pair is the format, and
    // padding it to four would mean inventing two answers that can't be right.
    const trueFalse = q.o.length === 2 && q.o.every((o) => ['صح', 'خطا'].includes(normalizeAr(o)));
    if (q.o.length !== 4 && !trueFalse) at(`has ${q.o.length} options, expected 4`);
    if (q.o.some((o) => !o.trim())) at('has an empty option');
    if (new Set(q.o.map(normalizeAr)).size !== q.o.length) at('has duplicate options');
    if (q.c < 0 || q.c >= q.o.length) at(`correct index ${q.c} is out of range`);
    // A prompt is either a question or a fill-in-the-blank stem ("عاصمة إسبانيا هي …").
    // Both are valid quiz formats; anything else is a statement and reads as broken.
    if (!/([؟?]|\.\.\.|…)\s*$/.test(q.ar)) at('prompt is neither a question nor a fill-in-the-blank stem');

    const answer = q.o[q.c] ?? '';
    if (isAnswerLeak(q.ar, answer)) at(`prompt contains its own answer ("${answer}")`);

    const norm = normalizeAr(q.ar);
    const previous = seen.get(norm);
    if (previous) at(`duplicate prompt (already in "${previous}")`);
    else seen.set(norm, cat.slug);

    // Off-topic: only policed *between* the marked groups — a religion question sitting
    // in a football bank, or the reverse. A category outside these groups is skipped
    // entirely, because a marker word in an unrelated bank is usually a legitimate
    // mention (a dialect question about «السحور» rightly says رمضان). Two markers are
    // required so a single passing word can't condemn a good question.
    const own = groupOf.get(cat.slug);
    if (own !== undefined && !CROSS_TOPIC.has(cat.slug)) {
      const text = `${q.ar} ${q.o.join(' ')}`;
      const mine = markerHits(text, own);
      for (let g = 0; g < TOPIC_MARKERS.length; g++) {
        if (g === own) continue;
        if (markerHits(text, g) >= 2 && mine === 0) {
          at(`reads as a ${TOPIC_MARKERS[g]!.slugs[0]} question, not ${cat.slug}`);
          break;
        }
      }
    }

    // Same quoted term AND same answer inside one category = one question written
    // twice. Scoped per category — «التراث» may be asked about in two banks.
    const term = quoted(q.ar);
    if (term) {
      const key = `${cat.slug}::${term}::${normalizeAr(answer)}`;
      const firstUse = seenQuoted.get(key);
      if (firstUse) at(`repeats «${term}» with the same answer (first asked: "${firstUse}")`);
      else seenQuoted.set(key, q.ar);
    }

    // Near-duplicate: same correct answer, and a prompt that asks nothing the other
    // didn't. Catches what exact-match and the «quoted term» rule both miss —
    //   "ما اسم صيغة الصور التي تدعم الشفافية؟"      ✓ بي إن جي
    //   "ما اسم صيغة الصور التي تدعم الخلفية الشفافة؟" ✓ بي إن جي
    // — two rows, one question, and the client's oldest complaint is that questions
    // repeat. Keyed on the answer first so the comparison stays cheap: only prompts
    // that already agree on the answer are ever compared word-by-word.
    const ansKey = `${cat.slug}::${normalizeAr(answer)}`;
    const words = contentWords(q.ar);
    const sameAnswer = byAnswer.get(ansKey);
    if (sameAnswer) {
      for (const prev of sameAnswer) {
        if (asksTheSame(words, prev.words)) {
          at(`near-duplicate of "${prev.prompt}" (same answer "${answer}")`);
          break;
        }
      }
      sameAnswer.push({ prompt: q.ar, words });
    } else {
      byAnswer.set(ansKey, [{ prompt: q.ar, words }]);
    }

    // Same-kind options: mixing "1999" with "برشلونة" makes the odd one out obvious.
    const numeric = q.o.filter(isNumeric).length;
    if (numeric !== 0 && numeric !== q.o.length) at('mixes numeric and textual options');

    // A giveaway of a different shape: the CORRECT option standing out by length.
    // Only length that correlates with correctness matters — a player who has learnt
    // that "the long one is the answer" never has to read the question. Options that
    // merely vary in length among themselves are fine.
    const lens = q.o.map((o) => o.trim().length);
    const others = lens.filter((_, i) => i !== q.c);
    const mine = lens[q.c] ?? 0;
    const avgOthers = others.reduce((a, b) => a + b, 0) / (others.length || 1);
    if (mine > Math.max(...others) && mine - avgOthers > 10 && mine > avgOthers * 1.7) {
      at('correct option is conspicuously the longest');
    }
    if (mine < Math.min(...others) && avgOthers - mine > 10 && avgOthers > mine * 1.7) {
      at('correct option is conspicuously the shortest');
    }
  }

  const hardPct = questions.length ? Math.round((hard / questions.length) * 100) : 0;
  if (hardPct > 25) problems.push({ slug: cat.slug, prompt: '—', issue: `${hardPct}% HARD (max 25%)` });
  fill.push({ slug: cat.slug, nameAr: cat.nameAr, n: questions.length, hard: hardPct });
}

const total = fill.reduce((n, f) => n + f.n, 0);
const target = CATEGORIES.length * TARGET_BANK_SIZE;

if (!process.argv.includes('--fill')) {
  if (problems.length === 0) {
    console.log(`✅ ${total} questions, no problems.`);
  } else {
    console.log(`❌ ${problems.length} problems:\n`);
    // Breakdown by kind first — with a few hundred open problems, "which kind and how
    // many" is what decides where to start; the list below is for working through one.
    const kinds = new Map<string, number>();
    for (const p of problems) {
      const kind = p.issue.replace(/ \(.*/, '').replace(/"[^"]*"/g, '…').replace(/«[^»]*»/g, '…');
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    }
    for (const [kind, n] of [...kinds].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(5)}  ${kind}`);
    }
    console.log('');
    const limit = process.argv.includes('--all') ? problems.length : 200;
    const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
    const shown = only ? problems.filter((p) => p.slug === only) : problems;
    for (const p of shown.slice(0, limit)) {
      console.log(`  [${p.slug}] ${p.issue}\n      ${p.prompt}`);
    }
    if (shown.length > limit) console.log(`  … and ${shown.length - limit} more`);
  }
  console.log('');
}

console.log(`Progress to ${TARGET_BANK_SIZE}/category — ${total} / ${target} (${Math.round((total / target) * 100)}%)\n`);
for (const f of fill) {
  const pct = Math.min(100, Math.round((f.n / TARGET_BANK_SIZE) * 100));
  const bar = '█'.repeat(Math.round(pct / 5)).padEnd(20, '·');
  const done = f.n >= TARGET_BANK_SIZE ? '✔' : ' ';
  console.log(`${done} ${bar} ${String(f.n).padStart(4)}  ${f.slug.padEnd(24)} ${f.nameAr}`);
}

if (problems.length > 0 && !process.argv.includes('--fill')) process.exit(1);
