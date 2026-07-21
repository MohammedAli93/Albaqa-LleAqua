import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Check, Loader2, ChevronRight, LogIn, Wallet } from 'lucide-react';
import { type PlayerProfile } from '@tahaddi/shared';
import { useStore } from '../../store.js';
import { api } from '../../lib/config.js';
import { saveAccount, type Account } from '../../lib/account.js';

type Product = { sku: string; nameAr: string; nameEn?: string | null; kind: string; credits: number | null; priceMinor: number; currency: string };
type Stage = 'offer' | 'confirming' | 'success' | 'cancelled' | 'error';

const CURRENCY_AR: Record<string, string> = { SAR: 'ر.س', AED: 'د.إ', EGP: 'ج.م', KWD: 'د.ك', USD: '$' };
const money = (minor: number, cur: string) => `${(minor / 100).toLocaleString('en')} ${CURRENCY_AR[cur] ?? cur}`;
/** Per-package saving vs. buying single games, in the package's currency. */
const savingMinor = (p: Product, unitMinor: number) => (p.credits ?? 1) * unitMinor - p.priceMinor;

/**
 * Storefront — buy a game-credit package (1 / 2 / 5 / 10 full-version games).
 * Buying adds credits to the account; each PAID (35-question) game the host
 * starts consumes one. On return from Tap (`?upgrade=success&order=<id>`) we poll
 * the order and, once PAID, refresh the account so the new balance shows.
 */
export function Upgrade() {
  const { account, locale, set } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('offer');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load the credit packages. Non-fatal if it fails (offer just shows nothing).
  useEffect(() => {
    api<{ products: Product[] }>('/api/v1/payments/products')
      .then(({ products }) => {
        const credits = products.filter((p) => p.kind === 'CREDITS');
        setProducts(credits);
        // Default-select the single-game package (or the first available).
        setSelected(credits.find((p) => p.credits === 1)?.sku ?? credits[0]?.sku ?? null);
      })
      .catch(() => {});
  }, []);

  // Returning from Tap → confirm the order, then refresh the credit balance.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('upgrade');
    const orderId = params.get('order');
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
    // The webhook credits the wallet asynchronously — poll briefly.
    for (let i = 0; i < 12; i++) {
      try {
        const order = await api<{ status: string }>(`/api/v1/payments/orders/${orderId}`);
        if (order.status === 'PAID') {
          if (token) await refreshAccount(token);
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

  async function refreshAccount(token: string): Promise<void> {
    const me = await api<PlayerProfile>('/api/v1/player/me', { headers: { Authorization: `Bearer ${token}` } });
    const updated: Account = { ...me, token };
    saveAccount(updated);
    set({ account: updated });
  }

  async function buy(): Promise<void> {
    if (!account || !selected || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const returnUrl = window.location.origin + window.location.pathname;
      const { checkout } = await api<{ orderId: string; checkout: { kind: string; url?: string } }>(
        '/api/v1/payments/checkout/package',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${account.token}` },
          body: JSON.stringify({ provider: 'TAP', returnUrl, sku: selected }),
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

  // Unit price (single game) used to compute per-package savings.
  const unitMinor = products.find((p) => p.credits === 1)?.priceMinor ?? 2000;
  const balance = account?.credits ?? 0;

  return (
    <div className="flex min-h-dvh flex-col px-6 py-10">
      <button
        onClick={() => set({ appView: 'home', hostLaunch: null })}
        className="mb-4 inline-flex items-center gap-1.5 self-start rounded-full bg-bg-sunken px-4 py-2 font-display text-sm font-bold text-ink-secondary"
      >
        <ChevronRight size={16} /> رجوع
      </button>

      {/* Header card */}
      <div className="relative overflow-hidden rounded-xl4 p-7 text-center text-white shadow-card"
        style={{ backgroundImage: 'linear-gradient(150deg,#F59E0B,#F43F5E)' }}>
        <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
        <Sparkles className="mx-auto" size={40} />
        <h1 className="mt-3 font-display text-3xl font-black">باقات الألعاب</h1>
        <p className="mx-auto mt-2 max-w-xs text-white/90">اشترِ رصيد ألعاب — كل لعبة كاملة (٣٥ سؤالاً مع اختيار الفئات) تستهلك رصيداً واحداً.</p>
        {account && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/20 px-5 py-2 font-display text-lg font-black backdrop-blur">
            <Wallet size={18} /> رصيدك: {balance} {balance === 1 ? 'لعبة' : 'ألعاب'}
          </div>
        )}
      </div>

      {stage === 'confirming' ? (
        <div className="mt-10 flex items-center justify-center gap-3 py-5 text-ink-secondary">
          <Loader2 className="animate-spin" size={22} /> نؤكّد عملية الدفع…
        </div>
      ) : stage === 'success' ? (
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-center gap-2 font-display text-xl font-bold text-success">
            <Check size={22} /> تم إضافة الرصيد — رصيدك الآن {balance}
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => set({ appView: 'home' })}
            className="w-full rounded-2xl bg-gradient-brand py-5 font-display text-2xl font-bold text-white shadow-glow"
          >
            ابدأ لعبة كاملة
          </motion.button>
        </div>
      ) : !account ? (
        <div className="mt-10">
          <p className="mb-3 text-center text-ink-secondary">سجّل الدخول أولاً لشراء الباقات وإضافتها إلى حسابك.</p>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => set({ appView: 'login' })}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-brand py-5 font-display text-2xl font-bold text-white shadow-glow"
          >
            <LogIn size={22} /> تسجيل الدخول
          </motion.button>
        </div>
      ) : (
        <>
          {/* Package grid */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            {products.map((p) => {
              const active = p.sku === selected;
              const save = savingMinor(p, unitMinor);
              const best = p.credits === 10;
              return (
                <button
                  key={p.sku}
                  onClick={() => setSelected(p.sku)}
                  className={`relative flex flex-col items-center rounded-2xl border-2 p-4 text-center transition ${
                    active ? 'border-brand-coral bg-brand-coral/5' : 'border-black/10 bg-white hover:border-black/20'
                  }`}
                >
                  {best && (
                    <span className="absolute -top-2.5 rounded-full bg-warning px-2 py-0.5 text-[11px] font-black text-white">
                      أفضل قيمة
                    </span>
                  )}
                  <span className="font-display text-lg font-extrabold text-ink-primary">{p.nameAr}</span>
                  <span className="mt-1 font-display text-2xl font-black text-ink-primary">{money(p.priceMinor, p.currency)}</span>
                  {save > 0 ? (
                    <span className="mt-1 text-xs font-bold text-success">وفّر {money(save, p.currency)}</span>
                  ) : (
                    <span className="mt-1 text-xs text-ink-muted">&nbsp;</span>
                  )}
                  {active && (
                    <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-brand-coral text-white">
                      <Check size={13} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {err && <p className="mt-5 text-center text-danger">{err}</p>}

          {/* CTA */}
          <div className="mt-auto pt-8">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={buy}
              disabled={busy || !selected}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-brand py-5 font-display text-2xl font-bold text-white shadow-glow disabled:opacity-40"
            >
              {busy ? <Loader2 className="animate-spin" size={22} /> : <Wallet size={20} />}
              {busy ? 'لحظة…' : 'شراء الباقة'}
            </motion.button>
          </div>
        </>
      )}
    </div>
  );
}

function mapErr(code: string, locale: 'ar' | 'en'): string {
  if (code === 'PAYMENT_PROVIDER_UNSUPPORTED')
    return locale === 'ar' ? 'الدفع غير متاح حالياً — لم تُضبط بوابة الدفع بعد.' : 'Payments not configured yet.';
  if (code === 'UNAUTHENTICATED') return locale === 'ar' ? 'سجّل الدخول أولاً.' : 'Log in first.';
  return locale === 'ar' ? 'تعذّر بدء الدفع — حاول مجدداً.' : 'Could not start checkout.';
}
