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

export { ar, en };
