/**
 * Redis-backed room registry & state store. The authoritative live state lives
 * here so any server replica can serve any room (doc 06 §2).
 *
 * Keys:
 *   room:<gameId>   JSON RoomState     (TTL = GAME_ROOM_TTL_SEC, refreshed on write)
 *   code:<CODE>     gameId              (live code→game index)
 */
import { redis } from '../../lib/redis.js';
import { env } from '../../config/env.js';
import type { RoomState } from './types.js';

const TTL = env.GAME_ROOM_TTL_SEC;
const roomKey = (gameId: string) => `room:${gameId}`;
const codeKey = (code: string) => `code:${code.toUpperCase()}`;

export async function saveRoom(state: RoomState): Promise<void> {
  const multi = redis.multi();
  multi.set(roomKey(state.gameId), JSON.stringify(state), 'EX', TTL);
  multi.set(codeKey(state.roomCode), state.gameId, 'EX', TTL);
  await multi.exec();
}

export async function getRoom(gameId: string): Promise<RoomState | null> {
  const raw = await redis.get(roomKey(gameId));
  return raw ? (JSON.parse(raw) as RoomState) : null;
}

export async function getGameIdByCode(code: string): Promise<string | null> {
  return redis.get(codeKey(code));
}

export async function getRoomByCode(code: string): Promise<RoomState | null> {
  const gameId = await getGameIdByCode(code);
  return gameId ? getRoom(gameId) : null;
}

/** True if a live room currently holds this code (collision check at creation). */
export async function codeInUse(code: string): Promise<boolean> {
  return (await redis.exists(codeKey(code))) === 1;
}

export async function deleteRoom(state: Pick<RoomState, 'gameId' | 'roomCode'>): Promise<void> {
  await redis.del(roomKey(state.gameId), codeKey(state.roomCode));
}

/** Refresh TTLs to keep an active room alive. */
export async function touchRoom(state: Pick<RoomState, 'gameId' | 'roomCode'>): Promise<void> {
  await redis.expire(roomKey(state.gameId), TTL);
  await redis.expire(codeKey(state.roomCode), TTL);
}
