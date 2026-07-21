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

/** Latin tokens (≥2 chars, containing at least one letter) in a string, lowercased
 *  — e.g. "PES", "GTA", "EA", "VHS". Used to catch cross-script leaks the Arabic
 *  matcher can't see. Pure numbers (years like "2030", counts) are ignored: they're
 *  usually incidental to both prompt and answer, not a giveaway. */
function latinTokens(s: string): string[] {
  return (s.match(/[A-Za-z0-9]{2,}/g) ?? [])
    .filter((t) => /[A-Za-z]/.test(t))
    .map((t) => t.toLowerCase());
}

/** True when `correctAnswer` appears verbatim (whole word/phrase) in `prompt`. */
export function isAnswerLeak(prompt: string, correctAnswer: string): boolean {
  const ans = normalizeAr(correctAnswer);
  // True/false answers are format, not leaks.
  if (ans !== 'صح' && ans !== 'خطا' && ans.length >= 2) {
    const q = ` ${normalizeAr(prompt)} `;
    if (q.includes(` ${ans} `)) return true;
  }
  // Cross-script leak: a Latin token that is part of the correct answer also shows
  // up in the prompt (e.g. prompt "...(PES)؟" ✓ "PES (إي فوتبول)"). The Arabic
  // normaliser above can't catch these because the scripts differ.
  const promptLatin = new Set(latinTokens(prompt));
  if (promptLatin.size > 0) {
    for (const tok of latinTokens(correctAnswer)) {
      if (promptLatin.has(tok)) return true;
    }
  }
  return false;
}
