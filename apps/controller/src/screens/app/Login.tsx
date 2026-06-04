import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../store.js';

/**
 * Phone login. PLACEHOLDER auth: any code is accepted — wiring to the real
 * phone-OTP backend (POST /auth/otp/request + /verify, see doc 13) is the next
 * step. The flow/screens are final; only the verification is mocked.
 */
export function Login() {
  const { set, account } = useStore();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState(account?.phone ?? '+966');
  const [code, setCode] = useState('');

  const phoneOk = phone.replace(/[^0-9]/g, '').length >= 9;
  const codeOk = code.trim().length >= 4;

  function verify() {
    if (!codeOk) return;
    const existing = account && account.displayName && account.country;
    if (existing) {
      set({ account: { ...account!, phone }, appView: 'home' });
    } else {
      // carry the phone into profile completion
      set({
        account: { phone, displayName: '', avatarId: 'falcon', country: null, leagueWins: 0, cupWins: 0 },
        appView: 'profile',
      });
    }
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-10">
      <button onClick={() => set({ appView: 'splash' })} className="self-start text-ink-secondary">
        ← رجوع
      </button>

      <h1 className="mt-6 font-display text-4xl font-bold">تسجيل الدخول</h1>
      <p className="mt-2 text-ink-secondary">
        {step === 'phone' ? 'أدخل رقم جوالك لإرسال رمز التحقق' : `أدخل الرمز المُرسل إلى ${phone}`}
      </p>

      <div className="mt-8 space-y-5">
        {step === 'phone' ? (
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            dir="ltr"
            className="w-full rounded-2xl glass px-5 py-4 text-center font-display text-3xl outline-none focus:ring-2 focus:ring-brand-violet"
            placeholder="+9665XXXXXXXX"
          />
        ) : (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            inputMode="numeric"
            dir="ltr"
            className="tnum w-full rounded-2xl glass px-5 py-4 text-center font-display text-4xl font-bold tracking-[0.4em] outline-none focus:ring-2 focus:ring-brand-violet"
            placeholder="••••"
          />
        )}
      </div>

      <div className="mt-auto pt-8">
        {step === 'phone' ? (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => phoneOk && setStep('code')}
            disabled={!phoneOk}
            className="w-full rounded-2xl bg-gradient-brand py-5 font-display text-2xl font-bold shadow-glow disabled:opacity-40"
          >
            إرسال الرمز
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={verify}
            disabled={!codeOk}
            className="w-full rounded-2xl bg-gradient-brand py-5 font-display text-2xl font-bold shadow-glow disabled:opacity-40"
          >
            تأكيد
          </motion.button>
        )}
        {step === 'code' && (
          <p className="mt-3 text-center text-sm text-ink-muted">
            (مؤقتاً: أي رمز يعمل — سيُربط بنظام الرسائل لاحقاً)
          </p>
        )}
      </div>
    </div>
  );
}
