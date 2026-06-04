/** Player accounts: phone-OTP login + profile (البقاء للأقوى). */
import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { AppError, ErrorCode } from '@tahaddi/shared';
import { validate, valid } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ok } from '../respond.js';
import * as auth from '../../domain/auth/playerAuthService.js';
import { verifyPlayerToken } from '../../domain/auth/tokens.js';

export const playerRouter: ExpressRouter = Router();

const RequestOtpSchema = z.object({ phone: z.string().trim().min(8).max(20) });
const VerifyOtpSchema = z.object({
  phone: z.string().trim().min(8).max(20),
  code: z.string().trim().min(4).max(6),
});
const UpdateMeSchema = z.object({
  displayName: z.string().trim().min(2).max(20),
  country: z.string().trim().min(2).max(3),
  avatarId: z.string().min(1),
});

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
  '/auth/request',
  validate(RequestOtpSchema),
  asyncHandler(async (req, res) => {
    const { phone } = valid<typeof RequestOtpSchema>(req);
    ok(res, await auth.requestOtp(phone));
  }),
);

playerRouter.post(
  '/auth/verify',
  validate(VerifyOtpSchema),
  asyncHandler(async (req, res) => {
    const { phone, code } = valid<typeof VerifyOtpSchema>(req);
    ok(res, await auth.verifyOtpAndLogin(phone, code));
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
  validate(UpdateMeSchema),
  asyncHandler(async (req, res) => {
    ok(res, await auth.updatePlayer(playerId(req), valid<typeof UpdateMeSchema>(req)));
  }),
);
