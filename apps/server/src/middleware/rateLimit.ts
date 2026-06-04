/**
 * Redis-backed rate limiters so budgets hold across all replicas (doc 08 §5).
 * Falls back to in-memory if Redis is briefly unavailable (limiter degrades open
 * rather than blocking all traffic).
 */
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { ErrorCode } from '@tahaddi/shared';
import { redis } from '../lib/redis.js';
import { fail } from '../http/respond.js';

function make(windowMs: number, max: number, prefix: string): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...(args as [string, ...string[]])) as Promise<never>,
      prefix: `rl:${prefix}:`,
    }),
    handler: (_req, res) =>
      fail(res, 429, { code: ErrorCode.RATE_LIMITED, message: 'Too many requests, slow down' }),
  });
}

import { RATE_LIMITS } from '../config/limits.js';

export const limiters = {
  global: make(RATE_LIMITS.rest.global.windowMs, RATE_LIMITS.rest.global.max, 'global'),
  auth: make(RATE_LIMITS.rest.auth.windowMs, RATE_LIMITS.rest.auth.max, 'auth'),
  roomCreate: make(RATE_LIMITS.rest.roomCreate.windowMs, RATE_LIMITS.rest.roomCreate.max, 'room-create'),
  roomLookup: make(RATE_LIMITS.rest.roomLookup.windowMs, RATE_LIMITS.rest.roomLookup.max, 'room-lookup'),
  import: make(RATE_LIMITS.rest.import.windowMs, RATE_LIMITS.rest.import.max, 'import'),
};
