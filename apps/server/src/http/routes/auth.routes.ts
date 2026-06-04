import { Router, type Router as ExpressRouter } from 'express';
import { LoginSchema, ChangePasswordSchema } from '@tahaddi/shared';
import { validate, valid } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { limiters } from '../../middleware/rateLimit.js';
import { ok } from '../respond.js';
import * as authService from '../../domain/auth/authService.js';
import { isProd } from '../../config/env.js';

export const authRouter: ExpressRouter = Router();

const REFRESH_COOKIE = 'rt';
const cookieOpts = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

authRouter.post(
  '/login',
  limiters.auth,
  validate(LoginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = valid<typeof LoginSchema>(req);
    const result = await authService.login(email, password);
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOpts);
    ok(res, { accessToken: result.accessToken, user: result.user });
  }),
);

authRouter.post(
  '/refresh',
  limiters.auth,
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    const result = await authService.refresh(token ?? '');
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOpts);
    ok(res, { accessToken: result.accessToken });
  }),
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
  ok(res, { loggedOut: true });
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    ok(res, await authService.me(req.auth!.userId));
  }),
);

authRouter.post(
  '/password',
  requireAuth,
  validate(ChangePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = valid<typeof ChangePasswordSchema>(req);
    await authService.changePassword(req.auth!.userId, currentPassword, newPassword);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
    ok(res, { changed: true });
  }),
);
