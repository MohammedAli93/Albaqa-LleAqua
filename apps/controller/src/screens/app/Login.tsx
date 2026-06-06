import { useState } from 'react';
import { motion } from 'framer-motion';
import { ScanLine } from 'lucide-react';
import { MOBILE_REGEX, type PlayerProfile } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../../store.js';
import { api } from '../../lib/config.js';
import { saveAccount, type Account } from '../../lib/account.js';

type AuthResponse = { token: string; player: PlayerProfile; isNew: boolean };

/**
 * Account screen — register (username + email + mobile, all required & validated)
 * or log back in by mobile. No OTP/password.
 */
export function Login() {
  const { locale, set } = useStore();
  const [tab, setTab] = useState<'register' | 'login'>('register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('+966');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const usernameOk = username.trim().length >= 2 && username.trim().length <= 24;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const mobileOk = MOBILE_REGEX.test(mobile.trim());
  const canSubmit = tab === 'login' ? mobileOk : usernameOk && emailOk && mobileOk;

  function finish(r: AuthResponse) {
    const account: Account = { ...r.player, token: r.token };
    saveAccount(account);
    const complete = !!account.country;
    set({
      account,
      nickname: account.username,
      avatarId: account.avatarId,
      appView: complete ? 'home' : 'profile',
    });
  }

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setErr(null);
    try {
      if (tab === 'login') {
        finish(
          await api<AuthResponse>('/api/v1/player/auth/login', {
            method: 'POST',
            body: JSON.stringify({ mobile: mobile.trim() }),
          }),
        );
      } else {
        finish(
          await api<AuthResponse>('/api/v1/player/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              username: username.trim(),
              email: email.trim(),
              mobile: mobile.trim(),
            }),
          }),
        );
      }
    } catch (e) {
      setErr(mapErr(e instanceof Error ? e.message : 'ERROR', locale));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-6 py-10">
      {/* Brand wordmark */}
      <div className="mt-2 text-center">
        <h1 className="font-display text-5xl font-black text-gradient">{t(locale, 'appName')}</h1>
        <p className="mt-1 text-ink-secondary">برنامج المسابقات الأول</p>
      </div>

      <h2 className="mt-8 font-display text-3xl font-bold">
        {tab === 'register' ? t(locale, 'createAccount') : t(locale, 'login')}
      </h2>

      {/* Tabs */}
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl glass p-1">
        {(['register', 'login'] as const).map((k) => (
          <button
            key={k}
            onClick={() => { setTab(k); setErr(null); }}
            className={[
              'rounded-xl2 py-2.5 font-display font-bold transition',
              tab === k ? 'bg-gradient-brand text-white shadow-glow' : 'text-ink-secondary',
            ].join(' ')}
          >
            {t(locale, k === 'register' ? 'register' : 'login')}
          </button>
        ))}
      </div>

      <div className="mt-7 space-y-4">
        {tab === 'register' && (
          <>
            <Field label={t(locale, 'username')}>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.slice(0, 24))}
                dir="auto"
                className={inputCls}
                placeholder={t(locale, 'username')}
              />
            </Field>
            <Field label={t(locale, 'email')}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                inputMode="email"
                dir="ltr"
                className={inputCls}
                placeholder="name@example.com"
              />
            </Field>
          </>
        )}
        <Field label={t(locale, 'mobile')}>
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            inputMode="tel"
            dir="ltr"
            className={inputCls}
            placeholder="+9665XXXXXXXX"
          />
        </Field>
      </div>

      {err && <p className="mt-4 text-center text-danger">{err}</p>}

      <div className="mt-auto pt-8">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={submit}
          disabled={busy || !canSubmit}
          className="w-full rounded-2xl bg-gradient-brand py-5 font-display text-2xl font-bold text-white shadow-glow disabled:opacity-40"
        >
          {busy ? '…' : t(locale, tab === 'register' ? 'register' : 'login')}
        </motion.button>
        <button
          onClick={() => { setTab(tab === 'register' ? 'login' : 'register'); setErr(null); }}
          className="mt-4 w-full text-center text-ink-secondary"
        >
          {t(locale, tab === 'register' ? 'haveAccount' : 'noAccount')}
        </button>
        <button
          onClick={() => set({ appView: 'game', phase: 'join' })}
          className="glass mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-ink-secondary"
        >
          <ScanLine size={18} /> عندك كود؟ انضمّ مباشرة
        </button>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-2xl glass px-5 py-4 text-xl text-ink-primary outline-none focus:ring-2 focus:ring-brand-deep';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-ink-secondary">{label}</label>
      {children}
    </div>
  );
}

function mapErr(code: string, locale: 'ar' | 'en'): string {
  if (code === 'CONFLICT') return locale === 'ar' ? 'الحساب موجود بالفعل (اسم/بريد/جوال مستخدم)' : 'Account already exists';
  if (code === 'NOT_FOUND') return locale === 'ar' ? 'لا يوجد حساب بهذا الرقم — أنشئ حساباً' : 'No account for this number';
  if (code === 'VALIDATION_ERROR') return locale === 'ar' ? 'تحقّق من البيانات المُدخلة' : 'Check your details';
  return t(locale, 'error');
}
