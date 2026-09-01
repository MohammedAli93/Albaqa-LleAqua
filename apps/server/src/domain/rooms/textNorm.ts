/**
 * Arabic normalisation for text comparison at RUNTIME.
 *
 * A byte-for-byte twin of `prisma/questionFilter.ts#normalizeAr`, duplicated on
 * purpose: `prisma/` is seed-time tooling that is not part of the server bundle
 * (tsup only builds `src/`), so importing across that line would drag the bank
 * into the runtime. The two must stay in step — if you change one, change both.
 */
export function normalizeAr(s: string): string {
  return s
    .replace(/[ً-ٰٟ]/g, '') // strip tashkeel (diacritics)
    .replace(/[إأآا]/g, 'ا') // unify alef forms
    .replace(/ى/g, 'ي') // alef maqsura → ya
    .replace(/ة/g, 'ه') // ta marbuta → ha
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[«»"'.,،؟?!()[\]{}\-_/:]/g, ' ') // punctuation → space
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
