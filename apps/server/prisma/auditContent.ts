/**
 * Comprehensive bank audit — the client's 2026-08-30 request, point 9:
 *
 *   «نحتاج تدقيقًا شاملًا لبنك الأسئلة للتأكد من: صحة المعلومة، وجود إجابة واحدة
 *    صحيحة فقط، سلامة اللغة، عدم قدم المعلومة، تجنب الأسئلة الوصفية أو المختلف
 *    عليها»
 *
 * Nobody can hand-check 21,000 questions, and re-checking them after every content
 * batch is worse. So each of those five criteria is turned into a mechanical rule
 * that this file enforces, and the ones that cannot be mechanised (a bare fact
 * being true) are narrowed to the SHAPES that carry the risk — a question whose
 * answer moves with time, or whose answer is somebody's opinion.
 *
 * Run:
 *   pnpm --filter @tahaddi/server exec tsx prisma/auditContent.ts
 *   …add --fix to apply the safe, purely mechanical language repairs in place.
 *   …add --all to list every hit instead of a sample per rule.
 *
 * Complements the existing gates rather than repeating them:
 *   validateBank.ts — structure, duplicates, answer leaks, option kind, difficulty
 *   auditFit.ts     — is the question filed under the right category
 *   auditContent.ts — THIS FILE: language, ambiguity, staleness, subjectivity
 *
 * Exit code is non-zero when a BLOCKING rule fires, so it can gate a deploy.
 * Advisory rules (subjective / time-sensitive phrasing) report but never block —
 * they are a review queue for a human, not a hard error.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTION_BANK } from './questionBank.js';
import { CATEGORIES } from './taxonomy.js';
import { normalizeAr } from './questionFilter.js';
import type { BankQuestion } from './bank/types.js';

const BANK_DIR = join(dirname(fileURLToPath(import.meta.url)), 'bank');
const FIX = process.argv.includes('--fix');
const ALL = process.argv.includes('--all');

type Severity = 'block' | 'review';
interface Finding {
  rule: string;
  severity: Severity;
  slug: string;
  prompt: string;
  detail: string;
}
const findings: Finding[] = [];
const add = (rule: string, severity: Severity, slug: string, prompt: string, detail: string) =>
  findings.push({ rule, severity, slug, prompt, detail });

// ─────────────────────────── 3 · سلامة اللغة (language) ──────────────────────
//
// Purely mechanical typography faults. Every one of these is safe to repair
// automatically, which is what `--fix` does; the client had to report the space
// before «؟» by hand, and that should never have reached them.

/** [pattern, replacement, human-readable name] — applied to the Arabic prompt. */
const TYPO_RULES: [RegExp, string, string][] = [
  [/[  ‏]+([؟?!،؛])/g, '$1', 'space before punctuation'],
  [/([«(])\s+/g, '$1', 'space after an opening bracket'],
  [/\s+([»)])/g, '$1', 'space before a closing bracket'],
  [/ {2,}/g, ' ', 'double space'],
  [/(?<![\p{L}])فى(?![\p{L}])/gu, 'في', 'dotless «فى»'],
  [/(?<![\p{L}])التى(?![\p{L}])/gu, 'التي', 'dotless «التى»'],
  [/(?<![\p{L}])الذى(?![\p{L}])/gu, 'الذي', 'dotless «الذى»'],
  [/(?<![\p{L}])هى(?![\p{L}])/gu, 'هي', 'dotless «هى»'],
  [/(?<![\p{L}])أى(?![\p{L}])/gu, 'أي', 'dotless «أى»'],
  [/كم تبلغ عدد /g, 'كم عدد ', '«كم تبلغ عدد» (gender disagreement)'],
  // Interrogatives fused onto the next word — «ماهي» / «ماعدد» / «ماهو».
  [/(?<![\p{L}])ماهي(?![\p{L}])/gu, 'ما هي', '«ماهي» run together'],
  [/(?<![\p{L}])ماهو(?![\p{L}])/gu, 'ما هو', '«ماهو» run together'],
  [/(?<![\p{L}])ماعدد(?![\p{L}])/gu, 'ما عدد', '«ماعدد» run together'],
  [/(?<![\p{L}])متي(?![\p{L}])/gu, 'متى', 'dotless «متي»'],
  [/(?<![\p{L}])الي(?![\p{L}])/gu, 'إلى', 'dotless «الي»'],
];

/** Repair every mechanical typo in one string; returns the text plus what changed. */
function repair(text: string): { out: string; hits: string[] } {
  let out = text;
  const hits: string[] = [];
  for (const [rx, to, name] of TYPO_RULES) {
    if (rx.test(out)) {
      hits.push(name);
      out = out.replace(rx, to);
    }
    rx.lastIndex = 0;
  }
  const trimmed = out.trim();
  if (trimmed !== out) {
    hits.push('leading/trailing whitespace');
    out = trimmed;
  }
  return { out, hits };
}

// ────────────── 2 · إجابة واحدة صحيحة فقط (exactly one right answer) ──────────
//
// The client's «الزقازيق / أم الزقزوق / الزقزوق / أبو الزقازيق» example: four
// options so alike that the player is guessing at spelling, not knowledge — and
// more than one of them can reasonably be read as correct. Two shapes catch it:
//
//   a) one option is contained in another once normalised, so both are "right"
//      («لا إله إلا الله» inside «لا إله إلا الله محمد رسول الله»);
//   b) options that differ only in a prefix/suffix — near-identical strings.

/** Character-level similarity in [0,1] (normalised edit distance). */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return 1 - prev[n]! / Math.max(m, n);
}

/**
 * Words that make a longer option a genuinely different answer rather than a
 * superset of a shorter one — a year, a negation, a different entity. Without
 * this, «مصر» vs «مصر القديمة» would read as ambiguous when they are not.
 */
const CONTAINMENT_SAFE = /\d|لا |غير |عدم |ليس /;

function checkOptionAmbiguity(slug: string, q: BankQuestion): void {
  const norm = q.o.map((o) => normalizeAr(o));
  for (let i = 0; i < norm.length; i++) {
    for (let j = i + 1; j < norm.length; j++) {
      const a = norm[i]!;
      const b = norm[j]!;
      if (!a || !b) continue;
      const [short, long] = a.length <= b.length ? [a, b] : [b, a];

      // (a) The correct answer STARTS with another option, so that shorter option
      //     is also a true (if incomplete) answer — the client's Saudi-flag case.
      //     Suffix overlap is excluded on purpose: «ميلان» inside «إنتر ميلان» is
      //     two different clubs and a perfectly fair distractor.
      const correct = norm[q.c] ?? '';
      const other = i === q.c ? b : j === q.c ? a : '';
      if (
        other &&
        other.length >= 4 &&
        correct.length > other.length &&
        correct.startsWith(`${other} `) &&
        !CONTAINMENT_SAFE.test(correct)
      ) {
        add('ambiguous-options', 'block', slug, q.ar,
            `«${q.o[q.c]}» starts with «${other}», so the shorter option is also true`);
        continue;
      }
    }
  }

  // (b) A CLUSTER of look-alike options — three or more variants of one stem, so
  //     the player is choosing a spelling rather than an answer. That is exactly
  //     the client's «الزقازيق / أم الزقزوق / الزقزوق / أبو الزقازيق» case.
  //     A single similar PAIR is left alone on purpose: «الكسوف»/«الخسوف» and
  //     «النملة»/«النحلة» are different things that merely rhyme, and testing
  //     them against each other is a fair question.
  // Single-word options only. Multi-word options routinely share a head noun on
  // purpose («مؤرخون مسلمون» vs «أطباء مسلمون») and that is the question working,
  // not failing.
  const stems = norm.map((o) =>
    // Numeric options (a spread of years, a spread of counts) are alike on purpose.
    /[\d٠-٩]/.test(o) || (o.includes(' ') && !/^(ابو|ام|أبو|أم|ال) /.test(o))
      ? ''
      : o.replace(/^(ال|ابو |ام |أبو |أم )/, ''),
  );
  let cluster = 0;
  for (let i = 0; i < stems.length; i++) {
    let alike = 0;
    for (let j = 0; j < stems.length; j++) {
      if (i !== j && stems[i]!.length >= 4 && stems[j] && similarity(stems[i]!, stems[j]!) >= 0.6) alike++;
    }
    if (alike >= 2) cluster++;
  }
  if (cluster >= 3) {
    add('confusable-options', 'review', slug, q.ar,
        `${q.o.map((o) => `«${o}»`).join(' / ')} are all variants of one word — the player is guessing at spelling`);
  }
}

// ─────────── 5 · الأسئلة الوصفية أو المختلف عليها (subjective / disputed) ──────
//
// «ما اسم أشهر مباراة سعودية…» has no checkable answer — "most famous" is an
// opinion, and the client asked for these to become verifiable facts. Measurable
// superlatives (أطول / أكبر / أعلى / أسرع) are fine and deliberately absent here.

const SUBJECTIVE = [
  'أشهر', 'اشهر', 'أفضل', 'افضل', 'أجمل', 'اجمل', 'أسوأ', 'اسوأ', 'أروع', 'اروع',
  'أهم', 'اهم', 'أمتع', 'الأكثر شعبية', 'الأكثر شهرة', 'المفضل', 'المفضلة',
  'يُعتبر', 'يعتبر', 'تُعتبر', 'تعتبر', 'يُقال', 'يقال', 'الأشهر', 'الأحب',
];

/**
 * An opinion word is acceptable when the question is really asking about a named,
 * awarded or officially-measured thing — "best player" is subjective, "winner of
 * the Ballon d'Or" is not, even though both contain «أفضل».
 */
const OBJECTIVE_ANCHOR = [
  'جائزة', 'الكرة الذهبية', 'أوسكار', 'الأوسكار', 'حصل على', 'فاز', 'توّج', 'تتويج',
  'مبيعًا', 'مبيعا', 'الأكثر مبيعًا', 'تصنيف', 'رسمي', 'رسميًا', 'وفق', 'حسب',
  'يونسكو', 'اليونسكو', 'موسوعة', 'جينيس', 'استحقاق',
];

/**
 * «أشهر» is a homograph: "most famous" (an opinion) and the plural of شهر,
 * "months" (a plain fact). Counting «ثلاثة أشهر هجرية» as subjective would bury
 * the real hits, so the calendar sense is recognised and skipped.
 */
const MONTHS_SENSE = /(ثلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة|عشرة|عدة|بضعة|كم)\s+أشهر|أشهر\s+(هجرية|ميلادية|السنة|الحج|الحرم|قمرية|شمسية|في السنة)/;

function checkSubjective(slug: string, q: BankQuestion): void {
  const padded = ` ${q.ar.replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  const hit = SUBJECTIVE.find((w) => padded.includes(` ${w} `));
  if (!hit) return;
  if ((hit === 'أشهر' || hit === 'اشهر') && MONTHS_SENSE.test(q.ar)) return;
  if (OBJECTIVE_ANCHOR.some((w) => q.ar.includes(w))) return;
  add('subjective', 'review', slug, q.ar,
      `«${hit}» is an opinion — rewrite around a checkable fact`);
}

// ──────────────── 4 · عدم قدم المعلومة (answers that move with time) ──────────
//
// The tunnel question the client flagged («أطول نفق بري في العالم») was true when
// it was written and is not any more. Anything phrased as "right now" has the same
// half-life, so it is surfaced for review rather than left to rot.

const TIME_SENSITIVE = [
  'حاليا', 'حالياً', 'الحالي', 'الحالية', 'الآن', 'حتى الآن', 'إلى الآن',
  'الأحدث', 'أحدث', 'الرقم القياسي', 'يشغل منصب', 'يترأس', 'يرأس',
  'الرئيس الحالي', 'الملك الحالي', 'في الوقت الحالي', 'مؤخرا', 'مؤخراً', 'هذا العام',
];
// «اليوم» ("the day") and «آخر» ("another") are ordinary nouns far more often than
// they are "today" / "the latest", and «الآن» inside a gloss («بمعنى الآن») is the
// definition of a dialect word, not a claim about the present. Flagging those would
// bury the 180 real hits under a thousand false ones.
const NOT_ABOUT_NOW = /بمعنى|تعني|يعني|معناها|«[^»]*الآن[^»]*»/;

/** Records and rankings that change: "the world's largest X" ages the same way. */
const MOVING_SUPERLATIVE =
  /(أطول|أكبر|أعلى|أسرع|أغلى|أثرى|أضخم|أكثر)\s+\S*\s*(في العالم|عالميا|عالميًا|على مستوى العالم)/;

function checkStaleness(slug: string, q: BankQuestion): void {
  const padded = ` ${q.ar.replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  const hit = TIME_SENSITIVE.find((w) => padded.includes(` ${w} `));
  if (hit && !NOT_ABOUT_NOW.test(q.ar)) {
    add('time-sensitive', 'review', slug, q.ar,
        `«${hit}» pins the answer to today — anchor it to a date or a fixed event`);
    return;
  }
  if (MOVING_SUPERLATIVE.test(q.ar)) {
    add('moving-record', 'review', slug, q.ar,
        'a "largest/longest in the world" record — state the year, or use a fact that cannot be beaten');
  }
}

// ───────────────────── 1 · صحة المعلومة (accuracy risk shapes) ────────────────
//
// Truth itself is not mechanisable, but the SHAPES that go stale or get disputed
// are, and they are where the client's five reported errors all sat. On top of the
// two rules above:
//   · a numeric answer written ambiguously («4,16 ميلاً» — decimal or thousands?);
//   · a prompt that asserts a figure AND asks for a name (two facts to keep true);
//   · a stem too short to be a real question («صلاة العيد ؟»).

const AMBIGUOUS_NUMBER = /\d+,\d{1,2}(?!\d)/; // 4,16 — a comma used as a decimal point

/** Everything the bank uses to actually ask something. */
const INTERROGATIVES = [
  'ما', 'ماذا', 'من', 'مَن', 'كم', 'متى', 'أين', 'اين', 'كيف', 'لماذا', 'هل', 'أي',
  'أيّ', 'اي', 'أيهم', 'أيها', 'اذكر', 'حدد', 'سمِّ', 'يسمى', 'تسمى', 'يُسمى', 'تُسمى',
  'المقصود', 'معنى', 'تعني', 'يعني', 'يقصد', 'المعروف', 'اسم',
  // Arabic fuses the preposition into the interrogative: بم / مم / فيم / عم / لم.
  'بم', 'مم', 'فيم', 'فيما', 'عم', 'عما', 'بماذا', 'لمن', 'ممن', 'كيفما', 'أيان',
];

function checkAccuracyRisk(slug: string, q: BankQuestion): void {
  if (AMBIGUOUS_NUMBER.test(q.ar)) {
    add('ambiguous-number', 'block', slug, q.ar,
        'a comma inside a number reads as both a decimal point and a thousands separator');
  }
  // «صلاة العيد ؟» — a topic with a question mark stuck on the end. What makes it
  // a non-question is the missing interrogative, not the word count: «ماذا تعني
  // «شفيك»؟» is three words and perfectly complete.
  const flat = q.ar.replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  // Interrogatives attach to prefixes in Arabic («فأيها», «وما»), so match the word
  // regardless of a leading ف/و/ب/ل rather than on whole words only.
  const asks = INTERROGATIVES.some((w) => new RegExp(`(^|\\s)[فوبل]?${w}(\\s|$|ها|هم|هن)`).test(flat));
  const isBlank = /(\.\.\.|…)/.test(q.ar); // fill-in-the-blank stems are fine
  const words = flat.split(' ').filter(Boolean);
  // Only a SHORT prompt with no interrogative is a stub — «صلاة العيد ؟». A long
  // statement ending in «؟» is a legitimate style used all over the bank.
  if (!asks && !isBlank && words.length <= 4) {
    add('stub-prompt', 'block', slug, q.ar,
        `«${flat}» — no interrogative and only ${words.length} words: a topic, not a question`);
  }
}

// ─────────────────────────────── run every rule ──────────────────────────────

const bySlug = new Map(CATEGORIES.map((c) => [c.slug, c]));
let total = 0;
/** slug → the prompt/option repairs to write back, keyed by the original text. */
const repairs = new Map<string, Map<string, string>>();

for (const [slug, questions] of Object.entries(QUESTION_BANK)) {
  if (!bySlug.has(slug)) continue;
  for (const q of questions) {
    total++;
    const { out, hits } = repair(q.ar);
    if (hits.length) {
      add('language', 'block', slug, q.ar, hits.join(', '));
      if (!repairs.has(slug)) repairs.set(slug, new Map());
      repairs.get(slug)!.set(q.ar, out);
    }
    for (const opt of q.o) {
      const r = repair(opt);
      if (r.hits.length) {
        add('language-option', 'block', slug, q.ar, `«${opt}» → ${r.hits.join(', ')}`);
        if (!repairs.has(slug)) repairs.set(slug, new Map());
        repairs.get(slug)!.set(opt, r.out);
      }
    }
    checkOptionAmbiguity(slug, q);
    checkSubjective(slug, q);
    checkStaleness(slug, q);
    checkAccuracyRisk(slug, q);
  }
}

// ─────────────────────────────── --fix: write back ───────────────────────────
//
// Only the language rules are auto-applied: they are text-for-text substitutions
// with no judgement in them. Everything else needs a human to rewrite the
// question, so it is reported and never silently changed.

if (FIX && repairs.size) {
  let files = 0;
  let edits = 0;
  for (const file of readdirSync(BANK_DIR)) {
    if (!file.endsWith('.ts') || file === 'types.ts' || file === 'index.ts') continue;
    const path = join(BANK_DIR, file);
    let src = readFileSync(path, 'utf8');
    const before = src;
    for (const map of repairs.values()) {
      for (const [from, to] of map) {
        if (from === to) continue;
        // Bank entries are JS string literals: a prompt containing a quotation
        // mark is stored escaped, so match the escaped form too.
        const esc = (t: string) => t.replace(/"/g, '\\"');
        src = src.split(`"${from}"`).join(`"${to}"`);
        if (from.includes('"')) src = src.split(`"${esc(from)}"`).join(`"${esc(to)}"`);
      }
    }
    if (src !== before) {
      writeFileSync(path, src, 'utf8');
      files++;
      edits += 1;
    }
  }
  console.log(`\n✎ applied language repairs to ${files} file(s) (${edits} pass(es))`);
  console.log('  re-run without --fix to confirm, then run validateBank.ts\n');
}

// ─────────────────────────────────── report ──────────────────────────────────

const byRule = new Map<string, Finding[]>();
for (const f of findings) {
  if (!byRule.has(f.rule)) byRule.set(f.rule, []);
  byRule.get(f.rule)!.push(f);
}

const blocking = findings.filter((f) => f.severity === 'block');
const review = findings.filter((f) => f.severity === 'review');

console.log(`\n${total} questions audited · ${blocking.length} blocking · ${review.length} to review\n`);

const RULE_TITLES: Record<string, string> = {
  language: 'سلامة اللغة — prompt typography',
  'language-option': 'سلامة اللغة — option typography',
  'ambiguous-options': 'إجابة واحدة صحيحة — one option contains another',
  'confusable-options': 'إجابة واحدة صحيحة — options too alike to tell apart',
  'ambiguous-number': 'صحة المعلومة — a number written ambiguously',
  'stub-prompt': 'صحة المعلومة — not a self-contained question',
  subjective: 'الأسئلة الوصفية — opinion, not fact',
  'time-sensitive': 'قدم المعلومة — pinned to "now"',
  'moving-record': 'قدم المعلومة — a record that can be broken',
};

for (const severity of ['block', 'review'] as const) {
  const rules = [...byRule.entries()].filter(([, f]) => f[0]!.severity === severity);
  if (!rules.length) continue;
  console.log(severity === 'block' ? '── BLOCKING ──' : '── REVIEW QUEUE (advisory) ──');
  for (const [rule, hits] of rules.sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  ${RULE_TITLES[rule] ?? rule}  ·  ${hits.length}`);
    for (const f of ALL ? hits : hits.slice(0, 6)) {
      console.log(`    [${f.slug}] ${f.prompt.slice(0, 78)}`);
      console.log(`        ${f.detail}`);
    }
    if (!ALL && hits.length > 6) console.log(`    … and ${hits.length - 6} more (run with --all)`);
  }
  console.log('');
}

if (!findings.length) console.log('✅ no problems.\n');
process.exit(blocking.length ? 1 : 0);
