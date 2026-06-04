# 12. Entitlements & Monetization (البقاء للأقوى)

The sellable unit is **access to start a game**, not content. The **host** pays
(one screen, many phones join free). First game per host is free.

## Products (catalog)

| SKU | Arabic | Kind | Grant | Price |
|-----|--------|------|-------|-------|
| `game_1` | لعبة واحدة | CREDITS | +1 game | 20 SAR |
| `game_2` | لعبتين | CREDITS | +2 games | 35 SAR |
| `pass_6h` | ٦ ساعات (غير محدود) | TIME_PASS | 6h unlimited | 70 SAR |

Defined in `apps/server/src/domain/billing/entitlement.ts` (`PRODUCTS`), seeded into
the `Product` table. Prices in minor units (halalas): `2000 = 20 SAR`.

## Data model (Prisma)

- `Product` — catalog (kind = CREDITS | TIME_PASS, credits / durationMinutes, price).
- `Wallet` — per host (`ownerId` unique): `credits` + `freeGameUsed`.
- `GamePass` — time-boxed unlimited pass (`expiresAt`).
- `Order` extended with `productId` + `ownerId` (reuses the existing
  Order/Payment/WebhookEvent + PaymentProvider abstraction).

`ownerId` is the **host account id** (the `Player` model lands in the accounts
phase — entitlements are designed account-ready but not yet wired into the live
`createRoom`, since they need that identity).

## The createRoom gate (pure core)

`decideEntitlement(state, now)` (unit-tested) decides, in priority order:

1. **active time pass** → allow, consume nothing
2. **free first game** → allow, consume the free game
3. **a credit** → allow, consume one credit
4. otherwise → **deny** (`PAYMENT_REQUIRED` → client shows the purchase sheet)

On `allow`, the orchestrator persists `applyConsumption(state, decision)`. On a
paid order's webhook, `grantForProduct(product, now, currentPassExpiresAt)` tops
up credits or extends the pass (never shrinks an existing longer pass).

## Payments

- Gateway: a KSA-native provider (Moyasar / Tap / HyperPay) behind the existing
  `PaymentProvider` abstraction → **mada + Apple Pay + Visa/Mastercard**.
- **Web, not native iOS** → Apple Pay rides card rails through the gateway, so
  there is **no Apple 30% IAP cut** (only the ~2% gateway fee).
- Apple Pay on web requires HTTPS + a verified merchant domain (use the custom
  production domain).

## Open decisions

1. 6h pass clock starts at purchase or first game? (recommend: first game)
2. Free-game scope tied to a verified account / phone (anti-abuse).
3. "One game" = one full session (a League of 20–30 rounds, or one Cup).
4. Refund policy on a host-abandoned game.
