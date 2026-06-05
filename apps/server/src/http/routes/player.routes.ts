/** Player accounts: register (username/email/mobile) + login + profile. */
import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import {
  AppError,
  ErrorCode,
  PlayerRegisterSchema,
  PlayerLoginSchema,
  PlayerUpdateSchema,
} from '@tahaddi/shared';
import { validate, valid } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ok } from '../respond.js';
import * as auth from '../../domain/auth/playerAuthService.js';
import { verifyPlayerToken } from '../../domain/auth/tokens.js';

export const playerRouter: ExpressRouter = Router();

/** Bearer-token guard; attaches playerId to the request. */
function playerAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new AppError(ErrorCode.NOT_AUTHORIZED, 'مطلوب تسجيل الدخول'));
  try {
    (req as Request & { playerId?: string }).playerId = verifyPlayerToken(token).sub;
    next();
  } catch {
    next(new AppError(ErrorCode.NOT_AUTHORIZED, 'جلسة غير صالحة'));
  }
}
const playerId = (req: Request): string => (req as Request & { playerId?: string }).playerId!;

playerRouter.post(
  '/auth/register',
  validate(PlayerRegisterSchema),
  asyncHandler(async (req, res) => {
    ok(res, await auth.registerPlayer(valid<typeof PlayerRegisterSchema>(req)), 201);
  }),
);

playerRouter.post(
  '/auth/login',
  validate(PlayerLoginSchema),
  asyncHandler(async (req, res) => {
    const { mobile } = valid<typeof PlayerLoginSchema>(req);
    ok(res, await auth.loginPlayer(mobile));
  }),
);

playerRouter.get(
  '/me',
  playerAuth,
  asyncHandler(async (req, res) => ok(res, await auth.getPlayer(playerId(req)))),
);

playerRouter.patch(
  '/me',
  playerAuth,
  validate(PlayerUpdateSchema),
  asyncHandler(async (req, res) => {
    ok(res, await auth.updatePlayer(playerId(req), valid<typeof PlayerUpdateSchema>(req)));
  }),
);
