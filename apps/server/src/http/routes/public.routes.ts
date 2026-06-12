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
import { listPublicPackages, listCategoryGroups } from '../../domain/content/contentService.js';
import { verifyPlayerToken } from '../../domain/auth/tokens.js';

/** Best-effort: extract the host's Player id from an optional Bearer token.
 *  Hosting is open to guests, so a missing/invalid token is not an error here —
 *  it just means an anonymous host (who can only run the free tier). */
function optionalPlayerId(authHeader?: string): string | undefined {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return undefined;
  try {
    return verifyPlayerToken(token).sub;
  } catch {
    return undefined;
  }
}

export const publicRouter: ExpressRouter = Router();

publicRouter.get('/avatars', (_req, res) => ok(res, { avatars: AVATARS }));

publicRouter.get(
  '/categories/public',
  asyncHandler(async (_req, res) => ok(res, { groups: await listCategoryGroups() })),
);

publicRouter.get(
  '/packages/public',
  asyncHandler(async (_req, res) => ok(res, { packages: await listPublicPackages() })),
);

publicRouter.post(
  '/rooms',
  limiters.roomCreate,
  validate(CreateRoomSchema),
  asyncHandler(async (req, res) => {
    const { settings, tier } = valid<typeof CreateRoomSchema>(req);
    const hostPlayerId = optionalPlayerId(req.headers.authorization);
    ok(res, await roomService.createRoom({ settings, tier, hostPlayerId }), 201);
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
