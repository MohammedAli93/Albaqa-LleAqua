/**
 * Token utilities:
 *  - JWT access tokens for admins (stateless, short-lived, tokenVersion-revocable)
 *  - Refresh tokens (rotating, delivered via httpOnly cookie)
 *  - Opaque capability tokens for host/player sessions (random secret, only its
 *    hash is stored — see doc 08 §1)
 */
import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import type { UserRole } from '@tahaddi/shared';
import { env } from '../../config/env.js';

export interface AccessClaims {
  sub: string; // user id
  role: UserRole;
  tokenVersion: number;
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessClaims {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims;
}

export interface RefreshClaims {
  sub: string;
  tokenVersion: number;
}

export function signRefreshToken(claims: RefreshClaims): string {
  return jwt.sign(claims, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  } as SignOptions);
}

export function verifyRefreshToken(token: string): RefreshClaims {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshClaims;
}

// ── Player account tokens (phone-OTP login) ──────────────────────────────────

export interface PlayerClaims {
  sub: string; // player id
  typ: 'player';
}

export function signPlayerToken(playerId: string): string {
  return jwt.sign({ sub: playerId, typ: 'player' }, env.JWT_ACCESS_SECRET, {
    expiresIn: '30d',
  } as SignOptions);
}

export function verifyPlayerToken(token: string): PlayerClaims {
  const claims = jwt.verify(token, env.JWT_ACCESS_SECRET) as PlayerClaims;
  if (claims.typ !== 'player') throw new Error('not a player token');
  return claims;
}

// ── Capability tokens (host / player session) ────────────────────────────────

/** Generate a random capability secret (given to the client once, never stored raw). */
export function generateCapabilityToken(): string {
  return nanoid(40);
}

/** Hash a capability token with the server pepper for at-rest storage/comparison. */
export function hashCapabilityToken(token: string): string {
  return crypto
    .createHmac('sha256', env.TOKEN_PEPPER)
    .update(token)
    .digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
