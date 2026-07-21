/**
 * Provider-agnostic payment business logic. Knows only "orders" and "outcomes".
 * The source of truth for access is the verified webhook, never the client redirect.
 */
import { AppError, ErrorCode, type PaymentProviderId } from '@tahaddi/shared';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { getProvider } from './registry.js';
import type { CheckoutResult, RawWebhookRequest } from './PaymentProvider.js';

export async function createCheckout(
  packageId: string,
  provider: PaymentProviderId,
  customerEmail?: string,
  userId?: string,
): Promise<{ orderId: string; checkout: CheckoutResult }> {
  const pkg = await prisma.package.findFirst({ where: { id: packageId, deletedAt: null } });
  if (!pkg) throw new AppError(ErrorCode.NOT_FOUND, 'Package not found');
  if (!pkg.isPremium || pkg.priceMinor <= 0) {
    throw new AppError(ErrorCode.CONFLICT, 'Package is free — no purchase required');
  }

  const order = await prisma.order.create({
    data: { userId, packageId, amountMinor: pkg.priceMinor, currency: pkg.currency, status: 'PENDING' },
  });

  const checkout = await getProvider(provider).createCheckout({
    orderId: order.id,
    amountMinor: pkg.priceMinor,
    currency: pkg.currency,
    description: `Tahaddi package: ${pkg.titleEn ?? pkg.titleAr}`,
    customerEmail,
  });

  return { orderId: order.id, checkout };
}

/** Process an inbound webhook. Idempotent; grants entitlement on success. */
export async function handleWebhook(provider: PaymentProviderId, req: RawWebhookRequest): Promise<void> {
  const event = await getProvider(provider).parseWebhook(req);
  if (event.type === 'ignored') return;

  // Idempotency: dedupe via (provider, eventId). A retried webhook no-ops.
  try {
    await prisma.webhookEvent.create({
      data: { provider, eventId: event.providerEventId, type: event.type, payload: event as never, processedAt: new Date() },
    });
  } catch (err) {
    if (typeof err === 'object' && err && 'code' in err && (err as { code: string }).code === 'P2002') {
      logger.info({ eventId: event.providerEventId }, 'duplicate webhook ignored');
      return;
    }
    throw err;
  }

  if (!event.orderId) {
    logger.warn({ event }, 'webhook without orderId');
    return;
  }

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: event.orderId! } });
    if (!order) return;

    if (event.type === 'payment.succeeded') {
      if (order.status === 'PAID') return; // already granted (idempotent)
      await tx.order.update({ where: { id: order.id }, data: { status: 'PAID' } });
      await tx.payment.create({
        data: {
          orderId: order.id, provider, providerRef: event.providerRef,
          amountMinor: event.amountMinor, currency: event.currency, status: 'PAID',
        },
      });
      // Grant: a CREDITS package adds its game-credits to the host's wallet. The
      // status-guard above makes this run exactly once per order.
      if (order.ownerId && order.productId) {
        const product = await tx.product.findUnique({ where: { id: order.productId } });
        if (product?.kind === 'CREDITS' && product.credits && product.credits > 0) {
          await tx.wallet.upsert({
            where: { ownerId: order.ownerId },
            update: { credits: { increment: product.credits } },
            create: { ownerId: order.ownerId, credits: product.credits },
          });
        }
      }
    } else if (event.type === 'payment.failed') {
      await tx.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
    } else if (event.type === 'refund.succeeded') {
      await tx.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } });
    }
  });
}

export async function getOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, amountMinor: true, currency: true, packageId: true },
  });
  if (!order) throw new AppError(ErrorCode.NOT_FOUND, 'Order not found');
  return order;
}

/**
 * DEV/TEST ONLY: grant a few game-credits to a player without paying. The caller
 * (route) MUST gate this to non-production.
 */
export async function devGrantUnlock(playerId: string): Promise<void> {
  await prisma.wallet.upsert({
    where: { ownerId: playerId },
    update: { credits: { increment: 3 } },
    create: { ownerId: playerId, credits: 3 },
  });
}

/** Active products for the storefront (the game-credit packages), price + credits. */
export async function listActiveProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { sku: true, nameAr: true, nameEn: true, kind: true, credits: true, priceMinor: true, currency: true },
  });
}

/** Remaining game-credits in a host's wallet (0 if they have no wallet yet). */
export async function getPlayerCredits(playerId: string): Promise<number> {
  const wallet = await prisma.wallet.findUnique({ where: { ownerId: playerId }, select: { credits: true } });
  return wallet?.credits ?? 0;
}

/** Atomically spend one credit. Returns false (no decrement) if the host has none. */
export async function consumeCredit(playerId: string): Promise<boolean> {
  const res = await prisma.wallet.updateMany({
    where: { ownerId: playerId, credits: { gt: 0 } },
    data: { credits: { decrement: 1 } },
  });
  return res.count > 0;
}

/** Return a spent credit to the wallet (e.g. when game creation fails afterwards). */
export async function refundCredit(playerId: string): Promise<void> {
  await prisma.wallet.upsert({
    where: { ownerId: playerId },
    update: { credits: { increment: 1 } },
    create: { ownerId: playerId, credits: 1 },
  });
}

/** Has this user (or anyone, for shared ownership) paid for the package? */
export async function hasEntitlement(packageId: string, userId?: string): Promise<boolean> {
  const count = await prisma.order.count({
    where: { packageId, status: 'PAID', ...(userId ? { userId } : {}) },
  });
  return count > 0;
}

/**
 * Start a checkout for a game-credit package (by SKU), owned by the host's Player
 * account. The PAID order it eventually produces adds credits to the wallet via
 * the verified webhook (see handleWebhook).
 */
export async function createPackageCheckout(
  provider: PaymentProviderId,
  playerId: string,
  returnUrl: string,
  sku: string,
): Promise<{ orderId: string; checkout: CheckoutResult }> {
  const product = await prisma.product.findUnique({ where: { sku } });
  if (!product || !product.isActive || product.kind !== 'CREDITS') {
    throw new AppError(ErrorCode.NOT_FOUND, 'Package not available');
  }

  // Tap (and most gateways) reject a charge with no customer email/phone. The
  // player always has a verified email + mobile from registration — pass the
  // email so the hosted charge is accepted and the receipt reaches the buyer.
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { email: true },
  });

  const order = await prisma.order.create({
    data: {
      ownerId: playerId,
      productId: product.id,
      amountMinor: product.priceMinor,
      currency: product.currency,
      status: 'PENDING',
    },
  });

  const checkout = await getProvider(provider).createCheckout({
    orderId: order.id,
    amountMinor: product.priceMinor,
    currency: product.currency,
    description: product.nameEn ?? product.nameAr,
    customerEmail: player?.email,
    returnUrl,
  });

  return { orderId: order.id, checkout };
}
