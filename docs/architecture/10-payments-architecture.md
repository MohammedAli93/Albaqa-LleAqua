# 10 — Payments Architecture

Goal: support many regional providers (**Apple Pay, Google Pay, Mada, Fawry,
Stripe, Paymob**) and let them be added or swapped **without touching business
logic**. The business logic knows only about *orders* and *payment outcomes*, never
about a specific provider's API.

## 1. The abstraction: a Payment Provider port

We define one interface (a "port") that every provider adapter implements. The
domain depends on the port; adapters depend on provider SDKs. This is the
hexagonal/ports-and-adapters pattern.

```ts
// domain/payments/PaymentProvider.ts
export interface PaymentProvider {
  readonly id: PaymentProviderId;            // 'stripe' | 'paymob' | 'mada' | ...
  readonly supports: ProviderCapabilities;   // currencies, methods, regions

  // 1. Begin a payment for an order. Returns whatever the client needs to
  //    complete it (a client secret, a hosted redirect URL, a token, etc.)
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;

  // 2. Verify + parse an incoming webhook into a normalized event.
  parseWebhook(req: RawWebhookRequest): Promise<NormalizedPaymentEvent>;

  // 3. Optional: refund.
  refund?(input: RefundInput): Promise<RefundResult>;
}

type CheckoutResult =
  | { kind: 'client_secret'; clientSecret: string; publishableKey: string }
  | { kind: 'redirect'; url: string }
  | { kind: 'token'; token: string; extra?: Record<string, string> };

type NormalizedPaymentEvent = {
  providerEventId: string;          // for idempotency
  type: 'payment.succeeded' | 'payment.failed' | 'refund.succeeded' | 'ignored';
  orderId: string;                  // resolved from provider metadata
  providerRef: string;
  amountMinor: number;
  currency: string;
};
```

### Provider registry
```ts
// domain/payments/registry.ts
const providers = new Map<PaymentProviderId, PaymentProvider>();
register(new StripeProvider(config.stripe));
// register(new PaymobProvider(...)) etc. — added without touching callers
export const getProvider = (id) => providers.get(id) ?? throwUnsupported(id);
```

## 2. The provider-agnostic flow

```
Client                  PaymentService (domain)        Provider adapter      Bank/PSP
  │ POST /payments/checkout {packageId, provider}        │                     │
  │───────────────────────▶│ create Order(PENDING)       │                     │
  │                        │ provider.createCheckout ───▶│ call PSP ──────────▶│
  │ ◀── CheckoutResult ────│◀────────────────────────────│◀────────────────────│
  │ complete payment on client (Stripe Elements / Apple Pay sheet / redirect)   │
  │                                                       │                     │
  │                          PSP ── webhook ─────────────────────────────────▶ │
  │                        │ POST /payments/webhook/:provider                   │
  │                        │ provider.parseWebhook (verify sig) ── Normalized ─▶│
  │                        │ idempotent via WebhookEvent                         │
  │                        │ transition Order→PAID, record Payment, grant access │
```

**Key point:** `PaymentService` contains all the business rules (create order,
mark paid, grant package entitlement, audit). It calls the port. Swapping Stripe
for Paymob means writing a new adapter class — `PaymentService` is untouched.

## 3. Why each provider fits the same port

| Provider | `createCheckout` returns | Webhook signature |
|----------|--------------------------|-------------------|
| **Stripe** | `client_secret` (PaymentIntent) | `Stripe-Signature` HMAC over raw body |
| **Apple Pay** | via Stripe/Paymob as a payment method → `client_secret`/`token` | through the underlying PSP's webhook |
| **Google Pay** | same as Apple Pay (PSP-tokenized) | underlying PSP |
| **Mada** | `redirect` (hosted page) or PSP token (Saudi cards; usually via Paymob/HyperPay) | PSP signature |
| **Fawry** | `redirect` / reference code (cash + cards, Egypt) | Fawry signature header |
| **Paymob** | `token` → iframe / `redirect` | HMAC over ordered fields |

Apple Pay and Google Pay are **payment methods**, not standalone PSPs — they
tokenize a card that is then charged through Stripe or Paymob. The port models this
naturally: those "providers" delegate to a configured PSP adapter.

## 4. Money & correctness rules

- **Integer minor units** everywhere (`amountMinor` + ISO `currency`); never floats.
- **Idempotency** on both ends: `Idempotency-Key` on checkout creation;
  `WebhookEvent @@unique([provider, eventId])` on inbound webhooks — a retried
  webhook never double-grants.
- **Source of truth is the webhook**, not the client redirect. Access is granted
  only after a verified `payment.succeeded` webhook; the client "success" page is
  cosmetic and polls `GET /payments/orders/:id`.
- **Signature verification** uses the **raw** request body (Express configured to
  retain raw body on webhook routes) — parsing first would break HMAC checks.
- **State machine** for `Order`: `PENDING → PAID | FAILED | CANCELLED`, and
  `PAID → REFUNDED`. Illegal transitions rejected.

## 5. MVP delivery

- Ship the **port + registry + `PaymentService` + Stripe adapter** fully working
  (Stripe has the best test ergonomics and covers Apple/Google Pay).
- Provide **stub adapters** for Paymob/Mada/Fawry implementing the interface with
  `createCheckout`/`parseWebhook` throwing `NOT_IMPLEMENTED` but type-complete — so
  enabling a region later is "fill in the adapter," not "redesign."
- The rest of the app (packages marked `isPremium`, entitlement checks) works
  against `PaymentService` and is provider-blind.

## 6. Entitlement

On `payment.succeeded`, `PaymentService` grants the buyer access to the package
(records the paid `Order`; premium packages check for a `PAID` order before a host
can select them). Free packages skip the whole flow.

## 7. Security recap (see doc 08 §7)

No PAN on our servers · webhook signature + idempotency · least-privilege provider
keys per environment · redacted raw payloads · refunds audited.
