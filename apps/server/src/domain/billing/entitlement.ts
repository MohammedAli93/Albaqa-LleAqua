/**
 * Play-access entitlement core (البقاء للأقوى) — pure, I/O-free, unit-tested.
 *
 * The sellable unit is access to START a game (the host pays; phones join free).
 * Priority when a host tries to start a game:
 *   1. an active time pass (e.g. 6h unlimited) → allowed, consume nothing
 *   2. the one free game per host               → allowed, consume the free game
 *   3. a purchased game credit                  → allowed, consume one credit
 *   4. otherwise                                → denied (payment required)
 *
 * The orchestrator (createRoom, once host accounts exist) loads the host's Wallet
 * + active GamePass, calls decideEntitlement, and on `allow` persists the
 * consumption via applyConsumption. Products grant via grantForProduct on a paid
 * order. None of that I/O lives here.
 */

export type Consumption = 'FREE' | 'CREDIT' | 'PASS' | 'NONE';

export interface EntitlementState {
  freeGameUsed: boolean;
  credits: number;
  /** epoch ms of an active time-pass expiry, if any. */
  activePassExpiresAt?: number | null;
}

export interface EntitlementDecision {
  allow: boolean;
  consume: Consumption;
  reason?: 'PAYMENT_REQUIRED';
}

export function hasActivePass(state: EntitlementState, now: number): boolean {
  return state.activePassExpiresAt != null && now < state.activePassExpiresAt;
}

/** Decide whether the host may start a game now, and what it costs them. */
export function decideEntitlement(state: EntitlementState, now: number): EntitlementDecision {
  if (hasActivePass(state, now)) return { allow: true, consume: 'PASS' };
  if (!state.freeGameUsed) return { allow: true, consume: 'FREE' };
  if (state.credits > 0) return { allow: true, consume: 'CREDIT' };
  return { allow: false, consume: 'NONE', reason: 'PAYMENT_REQUIRED' };
}

/** Apply a decision's consumption to wallet state (pure — returns the new state). */
export function applyConsumption(
  state: EntitlementState,
  decision: EntitlementDecision,
): EntitlementState {
  if (!decision.allow) return state;
  if (decision.consume === 'FREE') return { ...state, freeGameUsed: true };
  if (decision.consume === 'CREDIT') return { ...state, credits: Math.max(0, state.credits - 1) };
  return state; // PASS / NONE: wallet unchanged
}

export type ProductKind = 'CREDITS' | 'TIME_PASS';

export interface Grant {
  /** Credits to add to the wallet (CREDITS products). */
  creditsDelta: number;
  /** New pass expiry epoch ms (TIME_PASS products), or null. */
  passExpiresAt: number | null;
}

/**
 * Compute the grant for a paid product. A new time pass starts from `now`; if the
 * host already has a later-expiring pass, the longer one wins (stacking-safe).
 */
export function grantForProduct(
  product: { kind: ProductKind; credits?: number | null; durationMinutes?: number | null },
  now: number,
  currentPassExpiresAt?: number | null,
): Grant {
  if (product.kind === 'CREDITS') {
    return { creditsDelta: product.credits ?? 0, passExpiresAt: currentPassExpiresAt ?? null };
  }
  const fresh = now + (product.durationMinutes ?? 0) * 60_000;
  const expiresAt = Math.max(fresh, currentPassExpiresAt ?? 0);
  return { creditsDelta: 0, passExpiresAt: expiresAt };
}

/** Catalog SKUs for البقاء للأقوى (prices in minor units — halalas; 2000 = 20 SAR). */
export const PRODUCTS = [
  { sku: 'game_1', nameAr: 'لعبة واحدة', kind: 'CREDITS' as ProductKind, credits: 1, durationMinutes: null, priceMinor: 2000 },
  { sku: 'game_2', nameAr: 'لعبتين', kind: 'CREDITS' as ProductKind, credits: 2, durationMinutes: null, priceMinor: 3500 },
  { sku: 'pass_6h', nameAr: '٦ ساعات (غير محدود)', kind: 'TIME_PASS' as ProductKind, credits: null, durationMinutes: 360, priceMinor: 7000 },
] as const;
