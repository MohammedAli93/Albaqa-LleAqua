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

/** Has this user (or anyone, for shared ownership) paid for the package? */
export async function hasEntitlement(packageId: string, userId?: string): Promise<boolean> {
  const count = await prisma.order.count({
    where: { packageId, status: 'PAID', ...(userId ? { userId } : {}) },
  });
  return count > 0;
}
