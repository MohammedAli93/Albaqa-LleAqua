/** /admin namespace — live ops feed (read-mostly) + moderation. */
import type { Namespace, Socket } from 'socket.io';
import {
  ClientEvent,
  EmptySchema,
  RoomTerminateSchema,
  ROLE_RANK,
  UserRole,
  AppError,
  ErrorCode,
} from '@tahaddi/shared';
import { adminAuth } from '../middleware/auth.js';
import { on } from '../handlerUtil.js';
import * as engine from '../../domain/game/engine.js';
import type { AdminSocketData } from '../socketContext.js';

export function registerAdminNamespace(adminNs: Namespace): void {
  adminNs.use(adminAuth);

  adminNs.on('connection', (socket: Socket) => {
    on(socket, ClientEvent.ADMIN_SUBSCRIBE, EmptySchema, async () => {
      socket.join('admin:feed');
      return { ok: true };
    });

    on(socket, ClientEvent.ADMIN_ROOM_TERMINATE, RoomTerminateSchema, async (input) => {
      const ctx = socket.ctx as AdminSocketData;
      if (ROLE_RANK[ctx.userRole] < ROLE_RANK[UserRole.ADMIN]) {
        throw new AppError(ErrorCode.FORBIDDEN, 'Admin role required');
      }
      await engine.abandonRoom(input.gameId);
      return { ok: true };
    });
  });
}
