/** Payment endpoints: checkout, provider webhooks (raw body), order status. */
import { Router, type Router as ExpressRouter, raw } from 'express';
import { z } from 'zod';
import { CheckoutSchema, AppError, ErrorCode, type PaymentProviderId } from '@tahaddi/shared';
import { validate, valid } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { ok } from '../respond.js';
import * as payments from '../../domain/payments/paymentService.js';
import { listProviders } from '../../domain/payments/registry.js';
import { verifyPlayerToken } from '../../domain/auth/tokens.js';

export const paymentsRouter: ExpressRouter = Router();

/** Require a valid player Bearer token; returns the player id or throws 401. */
function requirePlayerId(authHeader?: string): string {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw new AppError(ErrorCode.UNAUTHENTICATED, 'مطلوب تسجيل الدخول');
  try {
    return verifyPlayerToken(token).sub;
  } catch {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 'جلسة غير صالحة');
  }
}

paymentsRouter.get('/providers', (_req, res) => ok(res, { providers: listProviders() }));

paymentsRouter.get(
  '/products',
  asyncHandler(async (_req, res) => ok(res, { products: await payments.listActiveProducts() })),
);

/** Buy the one-time paid unlock (35-question tier) for the logged-in account. */
const UnlockCheckoutSchema = z.object({
  provider: z.enum(['STRIPE', 'PAYMOB', 'MADA', 'FAWRY', 'APPLE_PAY', 'GOOGLE_PAY']),
  /** The app's base URL — Stripe routes success/cancel back here. */
  returnUrl: z.string().url(),
});

paymentsRouter.post(
  '/checkout/unlock',
  validate(UnlockCheckoutSchema),
  asyncHandler(async (req, res) => {
    const playerId = requirePlayerId(req.headers.authorization);
    const { provider, returnUrl } = valid<typeof UnlockCheckoutSchema>(req);
    ok(res, await payments.createUnlockCheckout(provider as PaymentProviderId, playerId, returnUrl));
  }),
);

paymentsRouter.post(
  '/checkout',
  validate(CheckoutSchema),
  asyncHandler(async (req, res) => {
    const { packageId, provider } = valid<typeof CheckoutSchema>(req);
    ok(res, await payments.createCheckout(packageId, provider, undefined, req.auth?.userId));
  }),
);

/**
 * Webhook — RAW body preserved for signature verification. Must be registered
 * with express.raw (the global JSON parser is bypassed for this path in app.ts).
 */
const ProviderParam = z.object({
  provider: z.enum(['STRIPE', 'PAYMOB', 'MADA', 'FAWRY', 'APPLE_PAY', 'GOOGLE_PAY']),
});

paymentsRouter.post(
  '/webhook/:provider',
  raw({ type: '*/*', limit: '1mb' }),
  asyncHandler(async (req, res) => {
    const parsed = ProviderParam.safeParse(req.params);
    if (!parsed.success) throw new AppError(ErrorCode.VALIDATION_ERROR, 'Unknown provider');
    await payments.handleWebhook(parsed.data.provider as PaymentProviderId, {
      rawBody: req.body as Buffer,
      headers: req.headers,
    });
    res.json({ received: true });
  }),
);

paymentsRouter.get(
  '/orders/:id',
  validate(z.object({ id: z.string().uuid() }), 'params'),
  asyncHandler(async (req, res) => {
    const { id } = valid<z.ZodObject<{ id: z.ZodString }>>(req, 'params');
    ok(res, await payments.getOrder(id));
  }),
);
