/**
 * Player accounts (البقاء للأقوى). Players register with username + email +
 * mobile (all required & validated). There is no OTP/password: the mobile number
 * is the unique identity used to log back in.
 */
import {
  AppError,
  ErrorCode,
  type PlayerProfile,
  type PlayerRegisterInput,
  type PlayerUpdateInput,
} from '@tahaddi/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { signPlayerToken } from './tokens.js';
import { getPlayerCredits } from '../payments/paymentService.js';

type PlayerRow = {
  id: string;
  username: string;
  email: string;
  mobile: string;
  country: string | null;
  avatarId: string;
  pointsWins: number;
  eliminationWins: number;
  teamWins: number;
  gamesPlayed: number;
};

async function toPublic(p: PlayerRow): Promise<PlayerProfile> {
  const credits = await getPlayerCredits(p.id);
  return {
    id: p.id,
    username: p.username,
    email: p.email,
    mobile: p.mobile,
    country: p.country,
    avatarId: p.avatarId,
    pointsWins: p.pointsWins,
    eliminationWins: p.eliminationWins,
    teamWins: p.teamWins,
    gamesPlayed: p.gamesPlayed,
    credits,
    paidUnlocked: credits > 0,
  };
}

/** Canonical mobile form: strip spaces/dashes, keep an optional leading '+'. */
export function normalizeMobile(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^0-9]/g, '');
}

/** Map a Prisma unique-constraint violation to a friendly Arabic message. */
function uniqueFieldError(e: unknown): AppError | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    const target = (e.meta?.target as string[] | undefined)?.[0] ?? '';
    if (target.includes('username'))
      return new AppError(ErrorCode.CONFLICT, 'اسم المستخدم مستخدم بالفعل');
    if (target.includes('email'))
      return new AppError(ErrorCode.CONFLICT, 'البريد الإلكتروني مسجّل بالفعل');
    if (target.includes('mobile'))
      return new AppError(ErrorCode.CONFLICT, 'رقم الجوال مسجّل بالفعل');
    return new AppError(ErrorCode.CONFLICT, 'الحساب موجود بالفعل');
  }
  return null;
}

export async function registerPlayer(
  input: PlayerRegisterInput,
): Promise<{ token: string; player: PlayerProfile; isNew: boolean }> {
  const mobile = normalizeMobile(input.mobile);
  try {
    const player = await prisma.player.create({
      data: {
        username: input.username.trim(),
        email: input.email.trim().toLowerCase(),
        mobile,
        country: input.country ?? null,
        ...(input.avatarId ? { avatarId: input.avatarId } : {}),
      },
    });
    return { token: signPlayerToken(player.id), player: await toPublic(player), isNew: true };
  } catch (e) {
    const conflict = uniqueFieldError(e);
    if (conflict) throw conflict;
    throw e;
  }
}

/** Returning players log in by their registered mobile number. */
export async function loginPlayer(
  rawMobile: string,
): Promise<{ token: string; player: PlayerProfile; isNew: boolean }> {
  const mobile = normalizeMobile(rawMobile);
  const player = await prisma.player.findUnique({ where: { mobile } });
  if (!player)
    throw new AppError(ErrorCode.NOT_FOUND, 'لا يوجد حساب بهذا الرقم — أنشئ حساباً جديداً');
  return { token: signPlayerToken(player.id), player: await toPublic(player), isNew: false };
}

export async function getPlayer(playerId: string): Promise<PlayerProfile> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) throw new AppError(ErrorCode.NOT_FOUND, 'الحساب غير موجود');
  return toPublic(player);
}

export async function updatePlayer(
  playerId: string,
  data: PlayerUpdateInput,
): Promise<PlayerProfile> {
  try {
    const player = await prisma.player.update({
      where: { id: playerId },
      data: {
        ...(data.username ? { username: data.username.trim() } : {}),
        ...(data.email ? { email: data.email.trim().toLowerCase() } : {}),
        ...(data.country ? { country: data.country } : {}),
        ...(data.avatarId ? { avatarId: data.avatarId } : {}),
      },
    });
    return toPublic(player);
  } catch (e) {
    const conflict = uniqueFieldError(e);
    if (conflict) throw conflict;
    throw e;
  }
}
