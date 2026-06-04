/**
 * Phone-OTP verification core (البقاء للأقوى player accounts) — pure, I/O-free.
 *
 * The orchestrator generates a 6-digit code, hashes it (same scheme as session
 * tokens), stores a PlayerOtp row, and sends the raw code by SMS. On verify it
 * hashes the presented code and calls verifyOtp. Code generation, hashing and SMS
 * are I/O and live in the service layer; the rules below are pure and tested.
 */

export const OTP = {
  LENGTH: 6,
  TTL_MS: 5 * 60 * 1000, // a code is valid for 5 minutes
  MAX_ATTEMPTS: 5, // wrong tries before the code is locked
  RESEND_COOLDOWN_MS: 60 * 1000, // min gap between sends to one phone
} as const;

export interface OtpRecord {
  codeHash: string;
  expiresAt: number; // epoch ms
  attempts: number;
  consumedAt?: number | null;
}

export function isExpired(rec: OtpRecord, now: number): boolean {
  return now >= rec.expiresAt;
}
export function isConsumed(rec: OtpRecord): boolean {
  return rec.consumedAt != null;
}
export function attemptsLeft(rec: OtpRecord): number {
  return Math.max(0, OTP.MAX_ATTEMPTS - rec.attempts);
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'EXPIRED' | 'CONSUMED' | 'LOCKED' | 'MISMATCH' };

/**
 * Verify a presented code (already hashed with the storage scheme). Checks order:
 * consumed → expired → locked (too many attempts) → hash match. The caller bumps
 * `attempts` on MISMATCH and sets `consumedAt` on success.
 */
export function verifyOtp(rec: OtpRecord, presentedHash: string, now: number): OtpVerifyResult {
  if (isConsumed(rec)) return { ok: false, reason: 'CONSUMED' };
  if (isExpired(rec, now)) return { ok: false, reason: 'EXPIRED' };
  if (rec.attempts >= OTP.MAX_ATTEMPTS) return { ok: false, reason: 'LOCKED' };
  if (rec.codeHash !== presentedHash) return { ok: false, reason: 'MISMATCH' };
  return { ok: true };
}

/** May we send a fresh code to this phone yet? (cooldown since last send). */
export function canResend(lastSentAt: number | null | undefined, now: number): boolean {
  if (lastSentAt == null) return true;
  return now - lastSentAt >= OTP.RESEND_COOLDOWN_MS;
}

/**
 * Normalize a phone number to a comparable form: keep a single leading '+' and
 * digits only. (E.164 validation proper belongs to the input schema; this just
 * makes lookups consistent so '+966 50…' and '+96650…' are the same key.)
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^0-9]/g, '');
}
