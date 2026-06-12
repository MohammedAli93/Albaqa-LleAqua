/**
 * Payment provider port (doc 10). The domain depends on this interface; adapters
 * depend on provider SDKs. Adding Mada/Fawry/Paymob = a new adapter, with zero
 * change to PaymentService or the rest of the app.
 */
import type { PaymentProviderId } from '@tahaddi/shared';

export interface ProviderCapabilities {
  currencies: string[];
  methods: string[];
  regions: string[];
}

export interface CreateCheckoutInput {
  orderId: string;
  amountMinor: number;
  currency: string;
  description: string;
  customerEmail?: string;
  /** When set, the provider returns a HOSTED checkout the client redirects to
   *  (Stripe Checkout), with success/cancel routed back under this base URL.
   *  When absent, the provider returns an in-page client_secret (Elements). */
  returnUrl?: string;
}

export type CheckoutResult =
  | { kind: 'client_secret'; clientSecret: string; publishableKey: string }
  | { kind: 'redirect'; url: string }
  | { kind: 'token'; token: string; extra?: Record<string, string> };

export interface RawWebhookRequest {
  /** Raw, unparsed body — required for signature verification. */
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
}

export type NormalizedEventType =
  | 'payment.succeeded'
  | 'payment.failed'
  | 'refund.succeeded'
  | 'ignored';

export interface NormalizedPaymentEvent {
  providerEventId: string; // idempotency key
  type: NormalizedEventType;
  orderId: string | null;
  providerRef: string;
  amountMinor: number;
  currency: string;
}

export interface RefundInput {
  providerRef: string;
  amountMinor?: number;
}
export interface RefundResult {
  ok: boolean;
  providerRef: string;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly supports: ProviderCapabilities;
  readonly enabled: boolean;

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  parseWebhook(req: RawWebhookRequest): Promise<NormalizedPaymentEvent>;
  refund?(input: RefundInput): Promise<RefundResult>;
}
