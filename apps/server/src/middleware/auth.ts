/** JWT authentication + role-based authorization middleware. */
import type { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode, ROLE_RANK, type UserRole } from '@tahaddi/shared';
import { verifyAccessToken } from '../domain/auth/tokens.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from './errorHandler.js';

export interface AuthContext {
  userId: string;
  role: UserRole;
  tokenVersion: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/** Require a valid access token. Verifies signature AND current tokenVersion. */
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 'Missing bearer token');
  }
  const token = header.slice(7);

  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 'Invalid or expired token');
  }

  // tokenVersion check enables instant global revocation.
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { tokenVersion: true, isActive: true, role: true },
  });
  if (!user || !user.isActive || user.tokenVersion !== claims.tokenVersion) {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 'Session no longer valid');
  }

  req.auth = { userId: claims.sub, role: user.role, tokenVersion: user.tokenVersion };
  next();
});

/** Require at least `min` role. Use after requireAuth. */
export function requireRole(min: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AppError(ErrorCode.UNAUTHENTICATED));
      return;
    }
    if (ROLE_RANK[req.auth.role] < ROLE_RANK[min]) {
      next(new AppError(ErrorCode.FORBIDDEN, 'Insufficient role'));
      return;
    }
    next();
  };
}
