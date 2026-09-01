/**
 * Per-GAME repeat guard.
 *
 * The bank gates (validateBank's exact + near-duplicate rules) keep the *bank*
 * clean, but they compare a question only against the others in its own category
 * file, and only when a human runs them. What a player actually complains about is
 * narrower and harsher: two questions that feel like one, inside a single match.
 *
 *   client 2026-09-01 — «تكرر سؤال التخت الشرقي بصيغتين متقاربتين والإجابة نفسها»
 *                       «ظهر سؤالان متقاربان عن بروس لي في الفئة نفسها»
 *                       «تكرر سؤال حرفيًا داخل فئة الفن الخليجي»
 *
 * So the draw itself now refuses a candidate that repeats one already picked for
 * this game. Three rules, cheapest first:
 *
 *   1. the same prompt (normalised) — the literal repeat;
 *   2. a prompt whose content words are a SUBSET of one already taken (or vice
 *      versa) — "one prompt adds detail and asks nothing new";
 *   3. the same correct answer AND ≥2 shared content words — two different
 *      phrasings of one fact. The word overlap is what keeps this honest: two
 *      unrelated questions that both answer «5» or «البرازيل» are still allowed,
 *      because nothing else about them lines up.
 *
 * Rejecting is free: every category holds hundreds of questions and a game takes
 * at most 35, so the guard just walks further down the least-used list.
 */
import { normalizeAr } from './textNorm.js';

/** Interrogative scaffolding shared by nearly every prompt in the bank. Left in,
 *  it would give two unrelated questions a head start toward looking alike. */
const STOP = new Set([
  'ما', 'من', 'هو', 'هي', 'اسم', 'التي', 'الذي', 'في', 'علي', 'الي', 'اي', 'كم', 'متي',
  'اين', 'كيف', 'لماذا', 'هل', 'عن', 'مع', 'هذا', 'هذه', 'يسمي', 'تسمي', 'تعني', 'يعني',
  'ماذا', 'كان', 'كانت', 'و', 'او', 'ثم', 'قد', 'بـ', 'التقليدي', 'التقليديه', 'الشهير',
  'المشهور', 'المعروف', 'اشهر', 'الاشهر', 'الكريم', 'الشريف',
]);

const contentWords = (s: string): Set<string> =>
  new Set(normalizeAr(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w)));

const isSubset = (a: Set<string>, b: Set<string>): boolean => {
  if (a.size === 0 || b.size === 0) return false;
  for (const w of a) if (!b.has(w)) return false;
  return true;
};

const overlap = (a: Set<string>, b: Set<string>): number => {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
};

/** The three fields the guard needs; `answerAr` is the CORRECT option's text. */
export interface GuardedQuestion {
  id: string;
  promptAr: string;
  answerAr: string;
}

export class RepeatGuard {
  private readonly prompts = new Set<string>();
  private readonly words: Set<string>[] = [];
  /** normalised correct answer → the content-word sets that already answered it. */
  private readonly byAnswer = new Map<string, Set<string>[]>();

  /**
   * Take `q` if it doesn't repeat anything taken so far, and remember it.
   * Returns false when it does — the caller should skip to the next candidate.
   */
  accept(q: GuardedQuestion): boolean {
    const prompt = normalizeAr(q.promptAr);
    if (this.prompts.has(prompt)) return false;

    const words = contentWords(q.promptAr);
    for (const prev of this.words) {
      if (isSubset(words, prev) || isSubset(prev, words)) return false;
    }

    const answer = normalizeAr(q.answerAr);
    const sameAnswer = this.byAnswer.get(answer);
    if (sameAnswer) {
      for (const prev of sameAnswer) if (overlap(words, prev) >= 2) return false;
      sameAnswer.push(words);
    } else if (answer) {
      this.byAnswer.set(answer, [words]);
    }

    this.prompts.add(prompt);
    this.words.push(words);
    return true;
  }
}

/** The correct option's Arabic text, from a question row's JSON `options`. */
export function correctAnswerText(
  options: unknown,
  correctOptionId: string | null | undefined,
): string {
  const opts = (options as { id: string; textAr?: string }[] | null) ?? [];
  return opts.find((o) => o.id === correctOptionId)?.textAr ?? '';
}
