/**
 * Ports the game engine depends on. Implemented by the realtime layer and
 * injected in — so the engine never imports Socket.IO (dependency points one way:
 * realtime → domain, never the reverse).
 */
import type { ServerEvent } from '@tahaddi/shared';

export interface GameEmitter {
  /** Broadcast to everyone in a game room (screen + all controllers). */
  toRoom(gameId: string, event: ServerEvent, payload: unknown): void;
  /** Send to a single connection (personal result, snapshot). */
  toSocket(socketId: string, event: ServerEvent, payload: unknown): void;
}
