/** Provider registry. Resolve a provider by id; callers never `new` an adapter. */
import { PaymentProviderId, AppError, ErrorCode } from '@tahaddi/shared';
import type { PaymentProvider } from './PaymentProvider.js';
import { StripeProvider } from './adapters/stripeProvider.js';
import { StubProvider } from './adapters/stubProvider.js';

const providers = new Map<PaymentProviderId, PaymentProvider>();

function register(p: PaymentProvider): void {
  providers.set(p.id, p);
}

// Fully implemented.
register(new StripeProvider());

// Regional placeholders — same interface, ready to be implemented.
register(new StubProvider(PaymentProviderId.PAYMOB, { currencies: ['EGP', 'SAR', 'AED'], methods: ['card'], regions: ['EG', 'SA', 'AE'] }));
register(new StubProvider(PaymentProviderId.MADA, { currencies: ['SAR'], methods: ['mada'], regions: ['SA'] }));
register(new StubProvider(PaymentProviderId.FAWRY, { currencies: ['EGP'], methods: ['cash', 'card'], regions: ['EG'] }));
register(new StubProvider(PaymentProviderId.APPLE_PAY, { currencies: ['USD', 'SAR', 'AED'], methods: ['apple_pay'], regions: ['global'] }));
register(new StubProvider(PaymentProviderId.GOOGLE_PAY, { currencies: ['USD', 'SAR', 'AED'], methods: ['google_pay'], regions: ['global'] }));

export function getProvider(id: PaymentProviderId): PaymentProvider {
  const p = providers.get(id);
  if (!p) throw new AppError(ErrorCode.PAYMENT_PROVIDER_UNSUPPORTED, `Unknown provider ${id}`);
  return p;
}

export function listProviders(): Array<{ id: PaymentProviderId; enabled: boolean; supports: PaymentProvider['supports'] }> {
  return [...providers.values()].map((p) => ({ id: p.id, enabled: p.enabled, supports: p.supports }));
}
