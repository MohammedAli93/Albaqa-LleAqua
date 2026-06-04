/** Authentication business logic: login, refresh, password change. */
import { AppError, ErrorCode, type UserRole } from '@tahaddi/shared';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword, lockoutUntil } from './password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './tokens.js';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

function toPublic(u: { id: string; email: string; displayName: string; role: UserRole }): PublicUser {
  return { id: u.id, email: u.email, displayName: u.displayName, role: u.role };
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const now = Date.now();

  // Uniform failure to avoid user enumeration.
  const invalid = () => new AppError(ErrorCode.UNAUTHENTICATED, 'Invalid credentials');

  if (!user || !user.isActive) {
    // Still spend ~hash time to reduce timing oracle.
    await verifyPassword('$argon2id$v=19$m=65536,t=3,p=4$invalid$invalid', password);
    throw invalid();
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > now) {
    throw new AppError(ErrorCode.RATE_LIMITED, 'Account temporarily locked');
  }

  const okPw = await verifyPassword(user.passwordHash, password);
  if (!okPw) {
    const failures = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: failures, lockedUntil: lockoutUntil(failures, now) },
    });
    throw invalid();
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date(now) },
  });

  const claims = { sub: user.id, role: user.role, tokenVersion: user.tokenVersion };
  return {
    accessToken: signAccessToken(claims),
    refreshToken: signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion }),
    user: toPublic(user),
  };
}

export async function refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  let claims;
  try {
    claims = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 'Invalid refresh token');
  }
  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user || !user.isActive || user.tokenVersion !== claims.tokenVersion) {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 'Session expired');
  }
  const next = { sub: user.id, role: user.role, tokenVersion: user.tokenVersion };
  return {
    accessToken: signAccessToken(next),
    refreshToken: signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion }),
  };
}

export async function me(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(ErrorCode.NOT_FOUND, 'User not found');
  return toPublic(user);
}

/** Change password and bump tokenVersion (revokes all existing sessions). */
export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(ErrorCode.NOT_FOUND, 'User not found');
  if (!(await verifyPassword(user.passwordHash, current))) {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 'Current password is incorrect');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(next), tokenVersion: { increment: 1 } },
  });
}
