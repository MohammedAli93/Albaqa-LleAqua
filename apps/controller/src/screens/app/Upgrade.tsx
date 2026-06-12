import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Check, Loader2, ChevronRight, LogIn, Lock } from 'lucide-react';
import { type PlayerProfile } from '@tahaddi/shared';
import { useStore } from '../../store.js';
import { api } from '../../lib/config.js';
import { saveAccount, type Account } from '../../lib/account.js';

type Product = { sku: string; nameAr: string; priceMinor: number; currency: string };
type Stage = 'offer' | 'confirming' | 'success' | 'cancelled' | 'error';

const CURRENCY_AR: Record<string, string> = { SAR: 'ر.س', AED: 'د.إ', EGP: 'ج.م', KWD: 'د.ك', USD: '$' };
const money = (minor: number, cur: string) => `${(minor / 100).toLocaleString('en')} ${CURRENCY_AR[cur] ?? cur}`;

/**
 * Upgrade screen — buy the one-time "Full Version" unlock (35-question paid tier).
 * Buying requires a logged-in account. The buy button starts a hosted Stripe
 * checkout (redirect); on return (`?upgrade=success&order=<id>`) we poll the order
 * and, once PAID, refresh the account so it shows as unlocked.
 */
export function Upgrade() {
  const { account, locale, set } = useStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [stage, setStage] = useState<Stage>('offer');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load the unlock product (for the price). Non-fatal if it fails.
  useEffect(() => {
    api<{ products: Product[] }>('/api/v1/payments/products')
      .then(({ products }) => setProduct(products.find((p) => p.sku === 'paid_unlock') ?? null))
      .catch(() => {});
  }, []);

  // Returning from Stripe → confirm the order, then flip the account to unlocked.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('upgrade');
    const orderId = params.get('order');
    // Strip the query so a refresh doesn't re-trigger this.
    window.history.replaceState({}, '', window.location.pathname);
    if (outcome === 'cancel') {
      setStage('cancelled');
      return;
    }
    if (outcome === 'success' && orderId) {
      setStage('confirming');
      void confirmOrder(orderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmOrder(orderId: string): Promise<void> {
    const token = account?.token;
    // The webhook marks the order PAID asynchronously — poll briefly.
    for (let i = 0; i < 12; i++) {
      try {
        const order = await api<{ status: string }>(`/api/v1/payments/orders/${orderId}`);
        if (order.status === 'PAID') {
          if (token) {
            const me = await api<PlayerProfile>('/api/v1/player/me', {
              headers: { Authorization: `Bearer ${token}` },
            });
            const updated: Account = { ...me, token };
            saveAccount(updated);
            set({ account: updated });
          }
          setStage('success');
          return;
        }
        if (order.status === 'FAILED') break;
      } catch {
        /* keep polling */
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setErr(locale === 'ar' ? 'لم نستلم تأكيد الدفع بعد — حدّث الصفحة بعد قليل.' : 'Payment not confirmed yet — refresh shortly.');
    setStage('error');
  }

  async function buy(): Promise<void> {
    if (!account || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const returnUrl = window.location.origin + window.location.pathname;
      const { checkout } = await api<{ orderId: string; checkout: { kind: string; url?: string } }>(
        '/api/v1/payments/checkout/unlock',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${account.token}` },
          body: JSON.stringify({ provider: 'STRIPE', returnUrl }),
        },
      );
      if (checkout.kind === 'redirect' && checkout.url) {
        window.location.href = checkout.url;
        return;
      }
      throw new Error('UNSUPPORTED_CHECKOUT');
    } catch (e) {
      setErr(mapErr(e instanceof Error ? e.message : 'ERROR', locale));
      setBusy(false);
    }
  }

  const alreadyUnlocked = !!account?.paidUnlocked || stage === 'success';

  return (
    <div className="flex min-h-dvh flex-col px-6 py-10">
      <button
        onClick={() => set({ appView: 'home', hostLaunch: null })}
        className="mb-4 inline-flex items-center gap-1.5 self-start rounded-full bg-bg-sunken px-4 py-2 font-display text-sm font-bold text-ink-secondary"
      >
        <ChevronRight size={16} /> رجوع
      </button>

      {/* Offer card */}
      <div className="relative overflow-hidden rounded-xl4 p-7 text-center text-white shadow-card"
        style={{ backgroundImage: 'linear-gradient(150deg,#F59E0B,#F43F5E)' }}>
        <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
        <Sparkles className="mx-auto" size={40} />
        <h1 className="mt-3 font-display text-3xl font-black">النسخة الكاملة</h1>
        <p className="mx-auto mt-2 max-w-xs text-white/90">٣٥ سؤالاً في كل لعبة، مع اختيار الفئات — تفعيل لمرة واحدة على حسابك.</p>
        {product && !alreadyUnlocked && (
          <div className="mt-4 inline-block rounded-2xl bg-white/20 px-5 py-2 font-display text-2xl font-black backdrop-blur">
            {money(product.priceMinor, product.currency)}
          </div>
        )}
      </div>

      {/* Feature bullets */}
      <ul className="mt-6 space-y-3">
        <Bullet text="٣٥ سؤالاً لكل لعبة (بدل ١٥)" />
        <Bullet text="اختيار الفئات لكل لاعب" />
        <Bullet text="تفعيل دائم على حسابك — دفعة واحدة" />
      </ul>

      {err && <p className="mt-5 text-center text-danger">{err}</p>}

      {/* CTA */}
      <div className="mt-auto pt-8">
        {stage === 'confirming' ? (
          <div className="flex items-center justify-center gap-3 py-5 text-ink-secondary">
            <Loader2 className="animate-spin" size={22} /> نؤكّد عملية الدفع…
          </div>
        ) : alreadyUnlocked ? (
          <>
            <div className="mb-4 flex items-center justify-center gap-2 font-display text-xl font-bold text-success">
              <Check size={22} /> النسخة الكاملة مفعّلة
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => set({ appView: 'home' })}
              className="w-full rounded-2xl bg-gradient-brand py-5 font-display text-2xl font-bold text-white shadow-glow"
            >
              ابدأ لعبة كاملة
            </motion.button>
          </>
        ) : !account ? (
          <>
            <p className="mb-3 text-center text-ink-secondary">سجّل الدخول أولاً لتفعيل النسخة الكاملة على حسابك.</p>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => set({ appView: 'login' })}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-brand py-5 font-display text-2xl font-bold text-white shadow-glow"
            >
              <LogIn size={22} /> تسجيل الدخول
            </motion.button>
          </>
        ) : (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={buy}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-brand py-5 font-display text-2xl font-bold text-white shadow-glow disabled:opacity-40"
          >
            {busy ? <Loader2 className="animate-spin" size={22} /> : <Lock size={20} />}
            {busy ? 'لحظة…' : 'فعّل النسخة الكاملة'}
          </motion.button>
        )}
      </div>
    </div>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl glass px-4 py-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success/15 text-success">
        <Check size={18} />
      </span>
      <span className="font-semibold text-ink-primary">{text}</span>
    </li>
  );
}

function mapErr(code: string, locale: 'ar' | 'en'): string {
  if (code === 'PAYMENT_PROVIDER_UNSUPPORTED')
    return locale === 'ar' ? 'الدفع غير متاح حالياً — لم تُضبط بوابة الدفع بعد.' : 'Payments not configured yet.';
  if (code === 'CONFLICT') return locale === 'ar' ? 'حسابك مفعّل بالفعل.' : 'Already unlocked.';
  if (code === 'UNAUTHENTICATED') return locale === 'ar' ? 'سجّل الدخول أولاً.' : 'Log in first.';
  return locale === 'ar' ? 'تعذّر بدء الدفع — حاول مجدداً.' : 'Could not start checkout.';
}
