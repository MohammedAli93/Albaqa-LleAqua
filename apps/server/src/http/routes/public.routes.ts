/** Public (unauthenticated) endpoints: room bootstrap, lobby lookup, avatars,
 *  published packages. Rate-limited to resist enumeration & abuse. */
import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { AVATARS, CreateRoomSchema, GAME_LIMITS } from '@tahaddi/shared';
import { validate, valid } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { limiters } from '../../middleware/rateLimit.js';
import { ok } from '../respond.js';
import * as roomService from '../../domain/rooms/roomService.js';
import { listPublicPackages } from '../../domain/content/contentService.js';

export const publicRouter: ExpressRouter = Router();

publicRouter.get('/avatars', (_req, res) => ok(res, { avatars: AVATARS }));

publicRouter.get(
  '/packages/public',
  asyncHandler(async (_req, res) => ok(res, { packages: await listPublicPackages() })),
);

publicRouter.post(
  '/rooms',
  limiters.roomCreate,
  validate(CreateRoomSchema),
  asyncHandler(async (req, res) => {
    const { packageId, settings } = valid<typeof CreateRoomSchema>(req);
    ok(res, await roomService.createRoom(packageId, settings), 201);
  }),
);

const CodeParam = z.object({
  code: z.string().length(GAME_LIMITS.ROOM_CODE_LENGTH),
});

publicRouter.get(
  '/rooms/:code',
  limiters.roomLookup,
  validate(CodeParam, 'params'),
  asyncHandler(async (req, res) => {
    const { code } = valid<typeof CodeParam>(req, 'params');
    ok(res, await roomService.getLobbyInfo(code));
  }),
);
