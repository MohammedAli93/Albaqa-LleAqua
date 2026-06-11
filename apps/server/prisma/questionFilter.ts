/**
 * Answer-leak filter. A question "leaks" when its CORRECT answer is spelled out,
 * as a whole word/phrase, inside the question prompt itself — e.g.
 *   "في أي مدينة يقع نادي ريال مدريد؟"  ✓ مدريد
 *   "ما الأنمي عن «الكابتن ماجد»؟"        ✓ الكابتن ماجد
 * Such questions are unfair (the answer is visible) and are dropped at seed time.
 *
 * Deliberately conservative — only FULL-answer matches count, so legitimate
 * shared-noun phrasing is kept (e.g. "ما البحر…؟ ✓ البحر الأحمر" is NOT a leak:
 * you still must supply "الأحمر"). True/false questions are never leaks (their
 * "صح/خطأ" answer is part of the format, not a giveaway).
 */

/** Normalise Arabic for fuzzy whole-word matching. */
export function normalizeAr(s: string): string {
  return s
    .replace(/[ً-ٰٟ]/g, '') // strip tashkeel (diacritics)
    .replace(/[إأآا]/g, 'ا') // unify alef forms
    .replace(/ى/g, 'ي') // alef maqsura → ya
    .replace(/ة/g, 'ه') // ta marbuta → ha
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[«»"'.,،؟?!()\[\]{}\-_/:]/g, ' ') // punctuation → space
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** True when `correctAnswer` appears verbatim (whole word/phrase) in `prompt`. */
export function isAnswerLeak(prompt: string, correctAnswer: string): boolean {
  const ans = normalizeAr(correctAnswer);
  // True/false answers are format, not leaks.
  if (ans === 'صح' || ans === 'خطا') return false;
  // Too short to be a meaningful giveaway (single letter / empty).
  if (ans.length < 2) return false;
  const q = ` ${normalizeAr(prompt)} `;
  return q.includes(` ${ans} `);
}
