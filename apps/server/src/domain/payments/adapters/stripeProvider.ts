/** Stripe adapter — the fully-implemented reference provider. Also covers Apple
 *  Pay / Google Pay (they tokenize a card charged through this PaymentIntent). */
import Stripe from 'stripe';
import { PaymentProviderId, AppError, ErrorCode } from '@tahaddi/shared';
import { env } from '../../../config/env.js';
import type {
  PaymentProvider,
  CreateCheckoutInput,
  CheckoutResult,
  RawWebhookRequest,
  NormalizedPaymentEvent,
} from '../PaymentProvider.js';

export class StripeProvider implements PaymentProvider {
  readonly id = PaymentProviderId.STRIPE;
  readonly supports = {
    currencies: ['USD', 'SAR', 'AED', 'EUR', 'EGP'],
    methods: ['card', 'apple_pay', 'google_pay'],
    regions: ['global'],
  };
  readonly enabled: boolean;
  private stripe: Stripe | null;

  constructor() {
    this.enabled = !!env.STRIPE_SECRET_KEY;
    this.stripe = this.enabled ? new Stripe(env.STRIPE_SECRET_KEY) : null;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    if (!this.stripe) throw new AppError(ErrorCode.PAYMENT_PROVIDER_UNSUPPORTED, 'Stripe not configured');
    const intent = await this.stripe.paymentIntents.create({
      amount: input.amountMinor,
      currency: input.currency.toLowerCase(),
      description: input.description,
      receipt_email: input.customerEmail,
      automatic_payment_methods: { enabled: true },
      metadata: { orderId: input.orderId },
    });
    return {
      kind: 'client_secret',
      clientSecret: intent.client_secret!,
      publishableKey: env.STRIPE_PUBLISHABLE_KEY,
    };
  }

  async parseWebhook(req: RawWebhookRequest): Promise<NormalizedPaymentEvent> {
    if (!this.stripe) throw new AppError(ErrorCode.PAYMENT_PROVIDER_UNSUPPORTED, 'Stripe not configured');
    const sig = req.headers['stripe-signature'];
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(req.rawBody, sig as string, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new AppError(ErrorCode.NOT_AUTHORIZED, 'Invalid webhook signature');
    }

    const map = (type: NormalizedPaymentEvent['type'], pi: Stripe.PaymentIntent): NormalizedPaymentEvent => ({
      providerEventId: event.id,
      type,
      orderId: (pi.metadata?.orderId as string) ?? null,
      providerRef: pi.id,
      amountMinor: pi.amount,
      currency: pi.currency.toUpperCase(),
    });

    switch (event.type) {
      case 'payment_intent.succeeded':
        return map('payment.succeeded', event.data.object as Stripe.PaymentIntent);
      case 'payment_intent.payment_failed':
        return map('payment.failed', event.data.object as Stripe.PaymentIntent);
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        return {
          providerEventId: event.id,
          type: 'refund.succeeded',
          orderId: (charge.metadata?.orderId as string) ?? null,
          providerRef: charge.payment_intent as string,
          amountMinor: charge.amount_refunded,
          currency: charge.currency.toUpperCase(),
        };
      }
      default:
        return { providerEventId: event.id, type: 'ignored', orderId: null, providerRef: '', amountMinor: 0, currency: '' };
    }
  }
}
