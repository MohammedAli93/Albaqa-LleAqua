/** Analytics aggregates for the admin dashboard (doc 04 §6). */
import { prisma } from '../../lib/prisma.js';
import type { Page } from '@tahaddi/shared';

export async function overview(from?: Date, to?: Date) {
  const where = {
    ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
  };

  const [totalGames, completed, results, totalPlayers, contentCounts] = await Promise.all([
    prisma.game.count({ where }),
    prisma.game.count({ where: { ...where, status: 'COMPLETED' } }),
    prisma.gameResult.aggregate({ _avg: { durationSec: true, totalPlayers: true } }),
    prisma.participant.count(),
    prisma.$transaction([
      prisma.question.count({ where: { deletedAt: null } }),
      prisma.package.count({ where: { deletedAt: null } }),
      prisma.category.count({ where: { deletedAt: null } }),
    ]),
  ]);

  return {
    totalGames,
    completedGames: completed,
    completionRate: totalGames ? Math.round((completed / totalGames) * 100) : 0,
    uniquePlayers: totalPlayers,
    avgDurationSec: Math.round(results._avg.durationSec ?? 0),
    avgPlayersPerGame: Math.round((results._avg.totalPlayers ?? 0) * 10) / 10,
    questionCount: contentCounts[0],
    packageCount: contentCounts[1],
    categoryCount: contentCounts[2],
  };
}

export async function listSessions(cursor: string | undefined, limit: number): Promise<Page<unknown>> {
  const items = await prisma.game.findMany({
    where: { status: { in: ['COMPLETED', 'ABANDONED'] } },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: {
      package: { select: { titleAr: true, titleEn: true } },
      result: { select: { totalPlayers: true, totalRounds: true, durationSec: true } },
      _count: { select: { participants: true } },
    },
  });
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  return { items: page, nextCursor: hasMore ? page[page.length - 1]!.id : null };
}

/** Registered players (most recent first) for the admin Players view. */
export async function listPlayers(cursor: string | undefined, limit: number): Promise<Page<unknown>> {
  const items = await prisma.player.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: {
      id: true,
      username: true,
      email: true,
      mobile: true,
      country: true,
      avatarId: true,
      pointsWins: true,
      eliminationWins: true,
      gamesPlayed: true,
      createdAt: true,
    },
  });
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  return { items: page, nextCursor: hasMore ? page[page.length - 1]!.id : null };
}

export async function sessionDetail(gameId: string) {
  return prisma.game.findUnique({
    where: { id: gameId },
    include: {
      result: true,
      participants: { orderBy: { score: 'desc' } },
      rounds: { orderBy: { index: 'asc' } },
    },
  });
}

export async function revenueOverview() {
  const [orders, paid] = await Promise.all([
    prisma.order.count(),
    prisma.order.findMany({ where: { status: 'PAID' }, select: { amountMinor: true, currency: true } }),
  ]);
  const byCurrency: Record<string, number> = {};
  for (const o of paid) byCurrency[o.currency] = (byCurrency[o.currency] ?? 0) + o.amountMinor;
  return { totalOrders: orders, paidOrders: paid.length, revenueByCurrency: byCurrency };
}
