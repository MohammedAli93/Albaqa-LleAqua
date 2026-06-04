/**
 * Player phone-OTP auth (البقاء للأقوى). Uses the pure OTP rules (otp.ts) + the
 * PlayerOtp/Player models. SMS sending is not wired yet: the code is logged, and
 * (when OTP_DEV_RETURN=true) returned in the request response for testing.
 */
import crypto from 'node:crypto';
import { AppError, ErrorCode } from '@tahaddi/shared';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { hashCapabilityToken, signPlayerToken } from './tokens.js';
import { normalizePhone, canResend, verifyOtp, OTP } from './otp.js';

export interface PublicPlayer {
  id: string;
  phone: string;
  displayName: string;
  country: string | null;
  avatarId: string;
  leagueWins: number;
  cupWins: number;
  gamesPlayed: number;
}

function toPublic(p: {
  id: string; phone: string; displayName: string; country: string | null;
  avatarId: string; leagueWins: number; cupWins: number; gamesPlayed: number;
}): PublicPlayer {
  return {
    id: p.id, phone: p.phone, displayName: p.displayName, country: p.country,
    avatarId: p.avatarId, leagueWins: p.leagueWins, cupWins: p.cupWins, gamesPlayed: p.gamesPlayed,
  };
}

const sixDigits = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

export async function requestOtp(rawPhone: string): Promise<{ sent: boolean; devCode?: string }> {
  const phone = normalizePhone(rawPhone);
  const last = await prisma.playerOtp.findFirst({ where: { phone }, orderBy: { createdAt: 'desc' } });
  if (last && !canResend(last.createdAt.getTime(), Date.now())) {
    throw new AppError(ErrorCode.RATE_LIMITED, 'الرجاء الانتظار قبل طلب رمز جديد');
  }

  const code = sixDigits();
  await prisma.playerOtp.deleteMany({ where: { phone, consumedAt: null } });
  await prisma.playerOtp.create({
    data: { phone, codeHash: hashCapabilityToken(code), expiresAt: new Date(Date.now() + OTP.TTL_MS) },
  });

  // TODO: send `code` via an SMS provider (Unifonic / Taqnyat). For now: log it.
  logger.info({ phone }, 'player OTP issued');
  return env.OTP_DEV_RETURN ? { sent: true, devCode: code } : { sent: true };
}

export async function verifyOtpAndLogin(
  rawPhone: string,
  code: string,
): Promise<{ token: string; player: PublicPlayer; isNew: boolean }> {
  const phone = normalizePhone(rawPhone);
  const rec = await prisma.playerOtp.findFirst({ where: { phone }, orderBy: { createdAt: 'desc' } });
  if (!rec) throw new AppError(ErrorCode.NOT_AUTHORIZED, 'اطلب رمزاً أولاً');

  const result = verifyOtp(
    { codeHash: rec.codeHash, expiresAt: rec.expiresAt.getTime(), attempts: rec.attempts, consumedAt: rec.consumedAt?.getTime() ?? null },
    hashCapabilityToken(code),
    Date.now(),
  );
  if (!result.ok) {
    if (result.reason === 'MISMATCH') {
      await prisma.playerOtp.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
    }
    throw new AppError(ErrorCode.NOT_AUTHORIZED, 'رمز غير صحيح أو منتهي');
  }

  await prisma.playerOtp.update({ where: { id: rec.id }, data: { consumedAt: new Date() } });

  let player = await prisma.player.findUnique({ where: { phone } });
  let isNew = false;
  if (!player) {
    player = await prisma.player.create({ data: { phone, phoneVerified: true, displayName: '' } });
    isNew = true;
  } else if (!player.phoneVerified) {
    player = await prisma.player.update({ where: { id: player.id }, data: { phoneVerified: true } });
  }

  return { token: signPlayerToken(player.id), player: toPublic(player), isNew: isNew || !player.displayName };
}

export async function getPlayer(playerId: string): Promise<PublicPlayer> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) throw new AppError(ErrorCode.NOT_FOUND, 'الحساب غير موجود');
  return toPublic(player);
}

export async function updatePlayer(
  playerId: string,
  data: { displayName: string; country: string; avatarId: string },
): Promise<PublicPlayer> {
  const player = await prisma.player.update({
    where: { id: playerId },
    data: { displayName: data.displayName, country: data.country, avatarId: data.avatarId },
  });
  return toPublic(player);
}
