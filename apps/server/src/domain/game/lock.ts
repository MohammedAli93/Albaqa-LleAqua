/**
 * Per-room mutation lock. A single Redis lock key serializes every read-modify-
 * write against one room's RoomState, so concurrent intents (joins, answers,
 * draft picks, timer fires) can never clobber each other. Shared by the
 * elimination engine and the Seen-Jeem orchestrator — both lock the SAME key, so
 * the two formats are mutually exclusive on a given room.
 */
import { AppError, ErrorCode } from '@tahaddi/shared';
import { acquireLock } from '../../lib/redis.js';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Acquire the room lock, retrying briefly (it is held only for the few ms of a
 * read-modify-write, so contention clears fast). Returns a release fn, or null.
 */
export async function acquireRoomLock(
  gameId: string,
  ttlMs = 5000,
  tries = 200,
): Promise<(() => Promise<void>) | null> {
  const key = `lock:room:${gameId}`;
  for (let i = 0; i < tries; i++) {
    const release = await acquireLock(key, ttlMs);
    if (release) return release;
    await sleep(8);
  }
  return null;
}

/** Run a room-state read-modify-write atomically. */
export async function withRoomLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
  const release = await acquireRoomLock(gameId);
  if (!release) throw new AppError(ErrorCode.INTERNAL, 'Room busy — please retry');
  try {
    return await fn();
  } finally {
    await release();
  }
}
