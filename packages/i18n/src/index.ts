/** Minimal bilingual i18n. Arabic-first; English parity. */
import ar from './ar.js';
import en from './en.js';

export type Locale = 'ar' | 'en';
export type Messages = typeof ar;
export type MessageKey = keyof Messages;

const catalogues: Record<Locale, Messages> = { ar, en };

export const DEFAULT_LOCALE: Locale = 'ar';

export function isRTL(locale: Locale): boolean {
  return locale === 'ar';
}

/** Translate `key` for `locale`, interpolating {name} placeholders. */
export function t(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  let s = catalogues[locale][key] ?? catalogues.ar[key] ?? String(key);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

/**
 * Display name for a team. Team names are host-entered and usually already start
 * with «فريق» ("فريق أ"), while the message templates read «دور {team}» — so we
 * only prefix the word when the name doesn't already carry it. Without this the
 * screen said «دور فريق فريق أ» (client 2026-08-28).
 */
export function teamLabel(locale: Locale, name: string): string {
  const n = (name ?? '').trim();
  if (!n) return n;
  if (locale !== 'ar') return /^team/i.test(n) ? n : `Team ${n}`;
  return /^(ال)?فريق/.test(n) ? n : `فريق ${n}`;
}

/**
 * Arabic-correct player count: «لا يوجد لاعبون» / «لاعب واحد» / «لاعبان» /
 * «3 لاعبين» — Arabic has singular, dual and plural, so a single
 * "{count} لاعب" template was wrong for every count but one.
 */
export function playersLabel(locale: Locale, count: number): string {
  if (count <= 0) return t(locale, 'noPlayers');
  if (count === 1) return t(locale, 'onePlayer');
  if (count === 2) return t(locale, 'twoPlayers');
  return t(locale, 'manyPlayers', { count });
}

/**
 * Round counter. Inside the scripted count it reads «جولة 3 من 15»; past it
 * (elimination plays on to the last survivor) it switches to «جولة إضافية 1»
 * instead of the nonsense «جولة 45 من 15».
 */
export function roundLabel(locale: Locale, round: number, totalRounds: number): string {
  if (round <= 0) return '';
  if (totalRounds > 0 && round > totalRounds) {
    return t(locale, 'roundExtra', { current: round - totalRounds });
  }
  if (totalRounds > 0) return t(locale, 'roundOf', { current: round, total: totalRounds });
  return t(locale, 'roundNum', { current: round });
}

export { ar, en };
