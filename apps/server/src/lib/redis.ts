/**
 * Redis clients. Three connections by purpose:
 *  - `redis`    : general commands (state, locks, rate limits)
 *  - `pubClient`/`subClient` : dedicated pub/sub pair for the Socket.IO adapter
 *    (a connection in subscriber mode cannot issue normal commands).
 */
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const opts = { maxRetriesPerRequest: null as null, enableReadyCheck: true };

export const redis = new Redis(env.REDIS_URL, opts);
export const pubClient = new Redis(env.REDIS_URL, opts);
export const subClient = pubClient.duplicate();

for (const [name, client] of [
  ['redis', redis],
  ['pub', pubClient],
  ['sub', subClient],
] as const) {
  client.on('error', (err) => logger.error({ err, client: name }, 'redis error'));
  client.on('connect', () => logger.debug({ client: name }, 'redis connected'));
}

export async function pingRedis(): Promise<boolean> {
  try {
    const res = await redis.ping();
    return res === 'PONG';
  } catch {
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  await Promise.allSettled([redis.quit(), pubClient.quit(), subClient.quit()]);
}

/**
 * Acquire a short-lived distributed lock (round resolution, room mutation).
 * Returns a release function, or null if the lock is already held.
 */
export async function acquireLock(
  key: string,
  ttlMs = 5000,
): Promise<(() => Promise<void>) | null> {
  const token = `${process.pid}-${Math.floor(performance.now() * 1000)}`;
  const ok = await redis.set(key, token, 'PX', ttlMs, 'NX');
  if (ok !== 'OK') return null;

  return async () => {
    // Release only if we still own it (compare-and-delete via Lua).
    const lua = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
    await redis.eval(lua, 1, key, token);
  };
}
