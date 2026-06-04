/** Typed data attached to each socket after the auth middleware runs. */
import type { UserRole } from '@tahaddi/shared';

export interface ScreenSocketData {
  role: 'host';
  gameId: string;
  roomCode: string;
}

export interface PlaySocketData {
  role: 'player';
  gameId: string;
  roomCode: string;
  participantId?: string; // set after join / reconnect
}

export interface AdminSocketData {
  role: 'admin';
  userId: string;
  userRole: UserRole;
}

declare module 'socket.io' {
  interface Socket {
    ctx: ScreenSocketData | PlaySocketData | AdminSocketData;
  }
}
