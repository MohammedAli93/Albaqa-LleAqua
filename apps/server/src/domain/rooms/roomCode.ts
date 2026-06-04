/**
 * Room code generation. 6 chars from a 32-symbol unambiguous alphabet
 * (no 0/O/1/I/L), ~1.07e9 space. Live uniqueness checked against Redis.
 */
import { customAlphabet } from 'nanoid';
import { GAME_LIMITS } from '@tahaddi/shared';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const gen = customAlphabet(ALPHABET, GAME_LIMITS.ROOM_CODE_LENGTH);

export function newRoomCode(): string {
  return gen();
}
