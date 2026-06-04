/** Password hashing (argon2id) + login lockout policy. */
import argon2 from 'argon2';

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain).catch(() => false);
}

export const LOCKOUT = {
  maxFailures: 5,
  baseLockMs: 60_000, // 1 min, doubles each subsequent lock window
} as const;

/** Compute the lock expiry after `failures` consecutive failures, or null. */
export function lockoutUntil(failures: number, now: number): Date | null {
  if (failures < LOCKOUT.maxFailures) return null;
  const over = failures - LOCKOUT.maxFailures;
  const ms = LOCKOUT.baseLockMs * Math.pow(2, Math.min(over, 6));
  return new Date(now + ms);
}
