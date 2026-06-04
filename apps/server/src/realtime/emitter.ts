/** GameEmitter implementation over Socket.IO namespaces. */
import type { Namespace } from 'socket.io';
import type { ServerEvent } from '@tahaddi/shared';
import type { GameEmitter } from '../domain/game/ports.js';

export const roomName = (gameId: string) => `game:${gameId}`;

export function createEmitter(screenNs: Namespace, playNs: Namespace): GameEmitter {
  return {
    toRoom(gameId, event: ServerEvent, payload) {
      const room = roomName(gameId);
      screenNs.to(room).emit(event, payload);
      playNs.to(room).emit(event, payload);
    },
    toSocket(socketId, event: ServerEvent, payload) {
      // Personal messages target /play controllers (each socket is in a room
      // named after its own id).
      playNs.to(socketId).emit(event, payload);
    },
  };
}
