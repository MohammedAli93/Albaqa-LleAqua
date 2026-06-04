/** Namespace auth middlewares — run before any event is processed (doc 05 §2). */
import type { Socket } from 'socket.io';
import { ErrorCode, ROLE_RANK, UserRole } from '@tahaddi/shared';
import { getGameIdByCode, getRoom } from '../../domain/rooms/roomStore.js';
import { hashCapabilityToken, verifyAccessToken, safeEqual } from '../../domain/auth/tokens.js';
import { prisma } from '../../lib/prisma.js';

type Next = (err?: Error) => void;

function authError(code: ErrorCode, message: string): Error {
  const e = new Error(message);
  (e as Error & { data?: unknown }).data = { code };
  return e;
}

export async function screenAuth(socket: Socket, next: Next): Promise<void> {
  try {
    const { hostToken, roomCode } = socket.handshake.auth as { hostToken?: string; roomCode?: string };
    if (!hostToken || !roomCode) return next(authError(ErrorCode.NOT_AUTHORIZED, 'Missing host credentials'));

    const gameId = await getGameIdByCode(roomCode);
    if (!gameId) return next(authError(ErrorCode.UNKNOWN_ROOM, 'Room not found'));
    const state = await getRoom(gameId);
    if (!state) return next(authError(ErrorCode.UNKNOWN_ROOM, 'Room expired'));

    if (!safeEqual(hashCapabilityToken(hostToken), state.hostTokenHash)) {
      return next(authError(ErrorCode.NOT_AUTHORIZED, 'Invalid host token'));
    }
    socket.ctx = { role: 'host', gameId, roomCode: state.roomCode };
    next();
  } catch {
    next(authError(ErrorCode.INTERNAL, 'auth failed'));
  }
}

export async function playAuth(socket: Socket, next: Next): Promise<void> {
  try {
    const { roomCode } = socket.handshake.auth as { roomCode?: string };
    if (!roomCode) return next(authError(ErrorCode.UNKNOWN_ROOM, 'Missing room code'));
    const gameId = await getGameIdByCode(roomCode);
    if (!gameId) return next(authError(ErrorCode.UNKNOWN_ROOM, 'Room not found'));
    const state = await getRoom(gameId);
    if (!state) return next(authError(ErrorCode.UNKNOWN_ROOM, 'Room expired'));
    socket.ctx = { role: 'player', gameId, roomCode: state.roomCode };
    next();
  } catch {
    next(authError(ErrorCode.INTERNAL, 'auth failed'));
  }
}

export async function adminAuth(socket: Socket, next: Next): Promise<void> {
  try {
    const { accessToken } = socket.handshake.auth as { accessToken?: string };
    if (!accessToken) return next(authError(ErrorCode.UNAUTHENTICATED, 'Missing token'));
    const claims = verifyAccessToken(accessToken);
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { tokenVersion: true, isActive: true, role: true },
    });
    if (!user || !user.isActive || user.tokenVersion !== claims.tokenVersion) {
      return next(authError(ErrorCode.UNAUTHENTICATED, 'Session invalid'));
    }
    if (ROLE_RANK[user.role] < ROLE_RANK[UserRole.VIEWER]) {
      return next(authError(ErrorCode.FORBIDDEN, 'Insufficient role'));
    }
    socket.ctx = { role: 'admin', userId: claims.sub, userRole: user.role };
    next();
  } catch {
    next(authError(ErrorCode.UNAUTHENTICATED, 'Invalid token'));
  }
}
