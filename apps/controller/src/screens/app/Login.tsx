import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../store.js';
import { api } from '../../lib/config.js';
import { saveAccount, type Account } from '../../lib/account.js';

/** Phone-OTP login wired to the server (/api/v1/player/auth/*). SMS isn't live yet,
 *  so the server returns the code (OTP_DEV_RETURN) and we show it for testing. */
export function Login() {
  const { set } = useStore();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+966');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const phoneOk = phone.replace(/[^0-9]/g, '').length >= 9;
  const codeOk = code.trim().length >= 4;

  async function sendCode() {
    if (!phoneOk || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await api<{ sent: boolean; devCode?: string }>('/api/v1/player/auth/request', {
        method: 'POST', body: JSON.stringify({ phone }),
      });
      setDevCode(r.devCode ?? null);
      setStep('code');
    } catch (e) {
      setErr(mapErr(e));
    } finally { setBusy(false); }
  }

  async function verify() {
    if (!codeOk || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await api<{ token: string; player: Omit<Account, 'token'>; isNew: boolean }>(
        '/api/v1/player/auth/verify',
        { method: 'POST', body: JSON.stringify({ phone, code }) },
      );
      const account: Account = { ...r.player, token: r.token };
      saveAccount(account);
      const complete = !!account.displayName && !!account.country;
      set({ account, nickname: account.displayName, avatarId: account.avatarId, appView: complete ? 'home' : 'profile' });
    } catch (e) {
      setErr(mapErr(e));
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-10">
      <button onClick={() => set({ appView: 'splash' })} className="self-start text-ink-secondary">← رجوع</button>

      <h1 className="mt-6 font-display text-4xl font-bold">تسجيل الدخول</h1>
      <p className="mt-2 text-ink-secondary">
        {step === 'phone' ? 'أدخل رقم جوالك لإرسال رمز التحقق' : `أدخل الرمز المُرسل إلى ${phone}`}
      </p>

      <div className="mt-8 space-y-5">
        {step === 'phone' ? (
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel" dir="ltr"
            className="w-full rounded-2xl glass px-5 py-4 text-center font-display text-3xl outline-none focus:ring-2 focus:ring-brand-violet"
            placeholder="+9665XXXXXXXX"
          />
        ) : (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            inputMode="numeric" dir="ltr"
            className="tnum w-full rounded-2xl glass px-5 py-4 text-center font-display text-4xl font-bold tracking-[0.4em] outline-none focus:ring-2 focus:ring-brand-violet"
            placeholder="••••••"
          />
        )}
      </div>

      {devCode && step === 'code' && (
        <p className="mt-4 rounded-xl2 bg-brand-gold/15 p-3 text-center text-brand-gold">
          رمز التجربة: <span className="font-display text-2xl font-bold tnum">{devCode}</span>
        </p>
      )}
      {err && <p className="mt-4 text-center text-danger">{err}</p>}

      <div className="mt-auto pt-8">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={step === 'phone' ? sendCode : verify}
          disabled={busy || (step === 'phone' ? !phoneOk : !codeOk)}
          className="w-full rounded-2xl bg-gradient-brand py-5 font-display text-2xl font-bold shadow-glow disabled:opacity-40"
        >
          {busy ? '...' : step === 'phone' ? 'إرسال الرمز' : 'تأكيد'}
        </motion.button>
      </div>
    </div>
  );
}

function mapErr(e: unknown): string {
  const code = e instanceof Error ? e.message : 'ERROR';
  if (code === 'RATE_LIMITED') return 'الرجاء الانتظار قبل طلب رمز جديد';
  if (code === 'NOT_AUTHORIZED') return 'رمز غير صحيح أو منتهي';
  return 'حدث خطأ، حاول مجدداً';
}
