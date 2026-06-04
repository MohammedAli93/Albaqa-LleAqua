/**
 * Type-complete stub for regional providers not yet wired (Mada, Fawry, Paymob,
 * and the Apple/Google Pay PSP delegations). Enabling a region later means
 * filling in these two methods — no change anywhere else (doc 10 §5).
 */
import { AppError, ErrorCode, type PaymentProviderId } from '@tahaddi/shared';
import type {
  PaymentProvider,
  CreateCheckoutInput,
  CheckoutResult,
  RawWebhookRequest,
  NormalizedPaymentEvent,
  ProviderCapabilities,
} from '../PaymentProvider.js';

export class StubProvider implements PaymentProvider {
  readonly enabled = false;
  constructor(
    readonly id: PaymentProviderId,
    readonly supports: ProviderCapabilities,
  ) {}

  createCheckout(_input: CreateCheckoutInput): Promise<CheckoutResult> {
    throw new AppError(ErrorCode.PAYMENT_PROVIDER_UNSUPPORTED, `${this.id} is not enabled yet`);
  }
  parseWebhook(_req: RawWebhookRequest): Promise<NormalizedPaymentEvent> {
    throw new AppError(ErrorCode.PAYMENT_PROVIDER_UNSUPPORTED, `${this.id} is not enabled yet`);
  }
}
