import { describe, it, expect } from 'vitest';
import {
  verifyOtp,
  attemptsLeft,
  canResend,
  normalizePhone,
  OTP,
  type OtpRecord,
} from '../src/domain/auth/otp.js';

const NOW = 1_000_000_000;
const rec = (over: Partial<OtpRecord> = {}): OtpRecord => ({
  codeHash: 'HASH',
  expiresAt: NOW + OTP.TTL_MS,
  attempts: 0,
  consumedAt: null,
  ...over,
});

describe('verifyOtp', () => {
  it('accepts a matching, fresh, unconsumed code', () => {
    expect(verifyOtp(rec(), 'HASH', NOW)).toEqual({ ok: true });
  });
  it('rejects a wrong code as MISMATCH', () => {
    expect(verifyOtp(rec(), 'NOPE', NOW)).toEqual({ ok: false, reason: 'MISMATCH' });
  });
  it('rejects an expired code', () => {
    expect(verifyOtp(rec({ expiresAt: NOW - 1 }), 'HASH', NOW)).toEqual({ ok: false, reason: 'EXPIRED' });
  });
  it('rejects an already-consumed code', () => {
    expect(verifyOtp(rec({ consumedAt: NOW - 100 }), 'HASH', NOW)).toEqual({ ok: false, reason: 'CONSUMED' });
  });
  it('locks after MAX_ATTEMPTS even with the right code', () => {
    expect(verifyOtp(rec({ attempts: OTP.MAX_ATTEMPTS }), 'HASH', NOW)).toEqual({ ok: false, reason: 'LOCKED' });
  });
});

describe('attemptsLeft', () => {
  it('counts down and floors at zero', () => {
    expect(attemptsLeft(rec({ attempts: 2 }))).toBe(OTP.MAX_ATTEMPTS - 2);
    expect(attemptsLeft(rec({ attempts: 99 }))).toBe(0);
  });
});

describe('canResend', () => {
  it('allows the first send and blocks within the cooldown', () => {
    expect(canResend(null, NOW)).toBe(true);
    expect(canResend(NOW - 1000, NOW)).toBe(false);
    expect(canResend(NOW - OTP.RESEND_COOLDOWN_MS, NOW)).toBe(true);
  });
});

describe('normalizePhone', () => {
  it('keeps one leading + and digits only', () => {
    expect(normalizePhone('+966 50 123 4567')).toBe('+966501234567');
    expect(normalizePhone(' 0501234567 ')).toBe('0501234567');
  });
});
