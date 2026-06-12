/**
 * Provider-agnostic payment business logic. Knows only "orders" and "outcomes".
 * The source of truth for access is the verified webhook, never the client redirect.
 */
import { AppError, ErrorCode, PAID_UNLOCK_SKU, type PaymentProviderId } from '@tahaddi/shared';
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
      if (order.status === 'PAID') return; // already granted
      await tx.order.update({ where: { id: order.id }, data: { status: 'PAID' } });
      await tx.payment.create({
        data: {
          orderId: order.id, provider, providerRef: event.providerRef,
          amountMinor: event.amountMinor, currency: event.currency, status: 'PAID',
        },
      });
      // Entitlement: the buyer now owns the package (a PAID order is the grant).
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

/** Active products for the storefront (e.g. the paid unlock), price included. */
export async function listActiveProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { sku: true, nameAr: true, nameEn: true, kind: true, priceMinor: true, currency: true },
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
 * Has this Player account bought the one-time paid unlock (the 35-question tier)?
 * Entitlement = at least one PAID order for the unlock product owned by the player.
 */
export async function hasPaidUnlock(playerId: string): Promise<boolean> {
  const count = await prisma.order.count({
    where: { ownerId: playerId, status: 'PAID', product: { sku: PAID_UNLOCK_SKU } },
  });
  return count > 0;
}

/**
 * Start a checkout for the one-time paid unlock, owned by the host's Player
 * account. The PAID order it eventually produces IS the entitlement.
 */
export async function createUnlockCheckout(
  provider: PaymentProviderId,
  playerId: string,
  returnUrl: string,
): Promise<{ orderId: string; checkout: CheckoutResult }> {
  const product = await prisma.product.findUnique({ where: { sku: PAID_UNLOCK_SKU } });
  if (!product || !product.isActive) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Unlock product not available');
  }
  if (await hasPaidUnlock(playerId)) {
    throw new AppError(ErrorCode.CONFLICT, 'Account already unlocked');
  }

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
    returnUrl,
  });

  return { orderId: order.id, checkout };
}
