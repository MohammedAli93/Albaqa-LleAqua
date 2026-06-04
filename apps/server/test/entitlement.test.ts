import { describe, it, expect } from 'vitest';
import {
  decideEntitlement,
  applyConsumption,
  grantForProduct,
  hasActivePass,
  type EntitlementState,
} from '../src/domain/billing/entitlement.js';

const NOW = 1_000_000_000;
const base = (over: Partial<EntitlementState> = {}): EntitlementState => ({
  freeGameUsed: false,
  credits: 0,
  activePassExpiresAt: null,
  ...over,
});

describe('decideEntitlement (البقاء للأقوى gate)', () => {
  it('lets a brand-new host play their free game', () => {
    expect(decideEntitlement(base(), NOW)).toEqual({ allow: true, consume: 'FREE' });
  });

  it('consumes a credit once the free game is used', () => {
    expect(decideEntitlement(base({ freeGameUsed: true, credits: 2 }), NOW)).toEqual({
      allow: true,
      consume: 'CREDIT',
    });
  });

  it('denies with PAYMENT_REQUIRED when out of free game and credits', () => {
    expect(decideEntitlement(base({ freeGameUsed: true, credits: 0 }), NOW)).toEqual({
      allow: false,
      consume: 'NONE',
      reason: 'PAYMENT_REQUIRED',
    });
  });

  it('an active time pass is unlimited and outranks free/credits', () => {
    const s = base({ freeGameUsed: true, credits: 0, activePassExpiresAt: NOW + 60_000 });
    expect(decideEntitlement(s, NOW)).toEqual({ allow: true, consume: 'PASS' });
  });

  it('an expired pass falls back to credits/free', () => {
    const s = base({ freeGameUsed: false, activePassExpiresAt: NOW - 1 });
    expect(hasActivePass(s, NOW)).toBe(false);
    expect(decideEntitlement(s, NOW).consume).toBe('FREE');
  });
});

describe('applyConsumption', () => {
  it('marks the free game used', () => {
    const next = applyConsumption(base(), { allow: true, consume: 'FREE' });
    expect(next.freeGameUsed).toBe(true);
  });
  it('decrements a credit', () => {
    const next = applyConsumption(base({ freeGameUsed: true, credits: 2 }), { allow: true, consume: 'CREDIT' });
    expect(next.credits).toBe(1);
  });
  it('leaves the wallet untouched for a pass', () => {
    const s = base({ credits: 5, activePassExpiresAt: NOW + 1000 });
    expect(applyConsumption(s, { allow: true, consume: 'PASS' })).toEqual(s);
  });
});

describe('grantForProduct', () => {
  it('adds credits for a CREDITS product', () => {
    const g = grantForProduct({ kind: 'CREDITS', credits: 2 }, NOW);
    expect(g).toEqual({ creditsDelta: 2, passExpiresAt: null });
  });
  it('starts a 6h pass for a TIME_PASS product', () => {
    const g = grantForProduct({ kind: 'TIME_PASS', durationMinutes: 360 }, NOW);
    expect(g.passExpiresAt).toBe(NOW + 360 * 60_000);
  });
  it('extends from the later of now or an existing pass (no shrink)', () => {
    const existing = NOW + 10 * 60_000;
    const g = grantForProduct({ kind: 'TIME_PASS', durationMinutes: 360 }, NOW, existing);
    expect(g.passExpiresAt).toBe(NOW + 360 * 60_000); // fresh is later → wins
    const longer = NOW + 1000 * 60_000;
    const g2 = grantForProduct({ kind: 'TIME_PASS', durationMinutes: 360 }, NOW, longer);
    expect(g2.passExpiresAt).toBe(longer); // existing longer → preserved
  });
});
