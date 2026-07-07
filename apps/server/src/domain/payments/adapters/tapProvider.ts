/**
 * Tap Payments adapter (tap.company) — hosted-redirect flow for the MENA region
 * (mada, Visa/Mastercard, Apple Pay, KNET, Amex). Mirrors the Stripe adapter's
 * contract so nothing else in the payment domain changes.
 *
 * Flow:
 *  - createCheckout → POST /v2/charges with source `src_all` (Tap shows every
 *    enabled method on its own hosted page); returns { redirect, url } where the
 *    client sends the buyer. `redirect.url` carries our orderId back; `post.url`
 *    is our webhook.
 *  - parseWebhook → Tap POSTs the charge object. We DO NOT trust the body's
 *    status blindly: we re-retrieve the charge from Tap (GET /v2/charges/{id})
 *    with the secret key — an authenticated server-to-server read is the source
 *    of truth. We also verify the `hashstring` header when present.
 *
 * Money: Tap uses MAJOR units with currency-specific decimals (e.g. 20.00 SAR),
 * whereas our orders store minor units (2000). We convert on both directions.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentProviderId, AppError, ErrorCode } from '@tahaddi/shared';
import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';
import type {
  PaymentProvider,
  CreateCheckoutInput,
  CheckoutResult,
  RawWebhookRequest,
  NormalizedPaymentEvent,
  RefundInput,
  RefundResult,
} from '../PaymentProvider.js';

const TAP_API = 'https://api.tap.company/v2';

/** Decimal places Tap expects per currency (ISO-4217 minor-unit exponents). */
const CURRENCY_DECIMALS: Record<string, number> = {
  SAR: 2, AED: 2, USD: 2, EUR: 2, EGP: 2, QAR: 2,
  KWD: 3, BHD: 3, OMR: 3, JOD: 3,
};

function decimals(currency: string): number {
  return CURRENCY_DECIMALS[currency.toUpperCase()] ?? 2;
}
function toMajor(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** decimals(currency);
}
function toMinor(amountMajor: number, currency: string): number {
  return Math.round(amountMajor * 10 ** decimals(currency));
}

interface TapCharge {
  id: string;
  status: string; // INITIATED | IN_PROGRESS | CAPTURED | AUTHORIZED | FAILED | DECLINED | CANCELLED | RESTRICTED | VOID
  amount: number;
  currency: string;
  reference?: { gateway?: string; payment?: string };
  transaction?: { url?: string; created?: string };
  metadata?: Record<string, string>;
}

export class TapProvider implements PaymentProvider {
  readonly id = PaymentProviderId.TAP;
  readonly supports = {
    currencies: ['SAR', 'AED', 'KWD', 'BHD', 'QAR', 'OMR', 'EGP', 'USD'],
    methods: ['mada', 'card', 'apple_pay', 'google_pay', 'knet', 'benefit'],
    regions: ['SA', 'AE', 'KW', 'BH', 'QA', 'OM', 'EG'],
  };
  readonly enabled: boolean;

  constructor() {
    this.enabled = !!env.TAP_SECRET_KEY;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${env.TAP_SECRET_KEY}`,
      'Content-Type': 'application/json',
    };
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    if (!this.enabled) throw new AppError(ErrorCode.PAYMENT_PROVIDER_UNSUPPORTED, 'Tap not configured');

    // Tap always redirects to its hosted page. Carry our orderId on the return
    // URL so the app can poll order status; Tap appends `&tap_id=<charge>`.
    const base = input.returnUrl ?? env.PUBLIC_CONTROLLER_URL;
    const sep = base.includes('?') ? '&' : '?';
    const redirectUrl = `${base}${sep}upgrade=success&order=${input.orderId}`;
    const webhookUrl = `${env.PUBLIC_API_URL}/api/v1/payments/webhook/TAP`;

    const body = {
      amount: toMajor(input.amountMinor, input.currency),
      currency: input.currency.toUpperCase(),
      customer_initiated: true,
      threeDSecure: true,
      save_card: false,
      description: input.description,
      metadata: { orderId: input.orderId },
      reference: { order: input.orderId, transaction: input.orderId },
      receipt: { email: !!input.customerEmail, sms: false },
      customer: {
        first_name: 'Tahaddi',
        ...(input.customerEmail ? { email: input.customerEmail } : {}),
      },
      source: { id: 'src_all' },
      post: { url: webhookUrl },
      redirect: { url: redirectUrl },
    };

    const res = await fetch(`${TAP_API}/charges`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as TapCharge & { errors?: Array<{ description?: string }> };
    if (!res.ok || !data?.transaction?.url) {
      logger.error({ status: res.status, data }, 'Tap createCharge failed');
      const msg = data?.errors?.[0]?.description ?? 'Tap charge creation failed';
      throw new AppError(ErrorCode.PAYMENT_PROVIDER_UNSUPPORTED, msg);
    }
    return { kind: 'redirect', url: data.transaction.url };
  }

  async parseWebhook(req: RawWebhookRequest): Promise<NormalizedPaymentEvent> {
    if (!this.enabled) throw new AppError(ErrorCode.PAYMENT_PROVIDER_UNSUPPORTED, 'Tap not configured');

    let payload: TapCharge;
    try {
      payload = JSON.parse(req.rawBody.toString('utf8')) as TapCharge;
    } catch {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid Tap webhook body');
    }
    const chargeId = payload?.id;
    if (!chargeId || !chargeId.startsWith('chg_')) {
      // Refund/other objects arrive too; we only act on charges here.
      return { providerEventId: chargeId ?? '', type: 'ignored', orderId: null, providerRef: chargeId ?? '', amountMinor: 0, currency: '' };
    }

    // Defense-in-depth: verify Tap's hashstring signature when present.
    this.verifyHashstring(req.headers, payload);

    // Source of truth: re-retrieve the charge from Tap (authenticated).
    const charge = await this.retrieveCharge(chargeId);
    const orderId = (charge.metadata?.orderId as string) ?? null;
    const amountMinor = toMinor(charge.amount, charge.currency);
    const currency = charge.currency.toUpperCase();
    const status = charge.status?.toUpperCase();

    // eventId includes status so a later refund on the same charge isn't
    // deduped away as a repeat of the original success.
    const providerEventId = `${charge.id}:${status}`;
    const base = { providerEventId, orderId, providerRef: charge.id, amountMinor, currency };

    if (status === 'CAPTURED') return { ...base, type: 'payment.succeeded' };
    if (['FAILED', 'DECLINED', 'CANCELLED', 'VOID', 'RESTRICTED'].includes(status)) {
      return { ...base, type: 'payment.failed' };
    }
    // INITIATED / IN_PROGRESS / AUTHORIZED — not terminal yet.
    return { ...base, type: 'ignored' };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    if (!this.enabled) throw new AppError(ErrorCode.PAYMENT_PROVIDER_UNSUPPORTED, 'Tap not configured');
    const charge = await this.retrieveCharge(input.providerRef);
    const body: Record<string, unknown> = {
      charge_id: input.providerRef,
      currency: charge.currency,
      reason: 'requested_by_customer',
      ...(input.amountMinor != null ? { amount: toMajor(input.amountMinor, charge.currency) } : {}),
    };
    const res = await fetch(`${TAP_API}/refunds`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { id?: string; status?: string };
    return { ok: res.ok && !!data?.id, providerRef: data?.id ?? input.providerRef };
  }

  private async retrieveCharge(chargeId: string): Promise<TapCharge> {
    const res = await fetch(`${TAP_API}/charges/${chargeId}`, { headers: this.headers() });
    if (!res.ok) {
      logger.error({ status: res.status, chargeId }, 'Tap retrieveCharge failed');
      throw new AppError(ErrorCode.PAYMENT_PROVIDER_UNSUPPORTED, 'Could not verify Tap charge');
    }
    return (await res.json()) as TapCharge;
  }

  /**
   * Tap signs each webhook with `hashstring` = HMAC-SHA256(secretKey) over a
   * fixed field string. We verify when the header is present; if absent we fall
   * back to the authenticated charge retrieval (still safe).
   */
  private verifyHashstring(headers: RawWebhookRequest['headers'], p: TapCharge): void {
    const header = headers['hashstring'];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!provided) return; // rely on retrieveCharge instead

    const amount = toMajor(
      // p.amount is already major here (webhook body), format to currency decimals
      Math.round(p.amount * 10 ** decimals(p.currency)),
      p.currency,
    ).toFixed(decimals(p.currency));
    const toHash =
      `x_id${p.id}` +
      `x_amount${amount}` +
      `x_currency${p.currency}` +
      `x_gateway_reference${p.reference?.gateway ?? ''}` +
      `x_payment_reference${p.reference?.payment ?? ''}` +
      `x_status${p.status}` +
      `x_created${p.transaction?.created ?? ''}`;
    const expected = createHmac('sha256', env.TAP_SECRET_KEY).update(toHash).digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      logger.warn({ chargeId: p.id }, 'Tap webhook hashstring mismatch');
      throw new AppError(ErrorCode.NOT_AUTHORIZED, 'Invalid Tap webhook signature');
    }
  }
}
