import { useState } from 'react';
import { ScanLine } from 'lucide-react';
import { MOBILE_REGEX, type PlayerProfile } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../../store.js';
import { api } from '../../lib/config.js';
import { saveAccount, type Account } from '../../lib/account.js';
import {
  AuthShell, AuthCard, AuthField, SegTabs, CtaButton, authInputCls,
} from './AuthShell.js';

type AuthResponse = { token: string; player: PlayerProfile; isNew: boolean };

/**
 * Account screen — desert "Login" comp (Assets/Login screens 5·6). Register
 * (username + email + mobile, all required & validated) or log back in by mobile.
 * No OTP/password. Presentation rebuilt to the orange-card comp; logic unchanged.
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
    <AuthShell onBrand={() => set({ appView: 'home' })} navAction={<span>تسجيل الدخول</span>}>
      <AuthCard>
        <SegTabs
          value={tab}
          onChange={(k) => { setTab(k); setErr(null); }}
          tabs={[
            { key: 'register', label: t(locale, 'register') },
            { key: 'login', label: t(locale, 'login') },
          ]}
        />

        <div className="mt-6 space-y-4">
          {tab === 'register' && (
            <>
              <AuthField label={t(locale, 'username')}>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.slice(0, 24))}
                  dir="auto"
                  className={authInputCls}
                />
              </AuthField>
              <AuthField label={t(locale, 'email')}>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  inputMode="email"
                  dir="ltr"
                  className={`${authInputCls} text-right`}
                  placeholder="name@example.com"
                />
              </AuthField>
            </>
          )}
          <AuthField label={t(locale, 'mobile')}>
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              inputMode="tel"
              dir="ltr"
              className={`${authInputCls} text-right`}
              placeholder="+9665XXXXXXXX"
            />
          </AuthField>
        </div>

        {err && <p className="mt-4 text-center font-bold text-[#B3160B]">{err}</p>}

        <div className="mt-7">
          <CtaButton onClick={submit} disabled={busy || !canSubmit}>
            {busy ? '…' : t(locale, tab === 'register' ? 'register' : 'login')}
          </CtaButton>

          <button
            onClick={() => { setTab(tab === 'register' ? 'login' : 'register'); setErr(null); }}
            className="mt-4 block w-full text-center font-display font-bold text-desert-ink transition hover:opacity-70"
          >
            {t(locale, tab === 'register' ? 'haveAccount' : 'noAccount')}
          </button>

          <div className="mt-3 flex justify-center">
            <CtaButton variant="blue" onClick={() => set({ appView: 'game', phase: 'join' })}>
              <span className="inline-flex items-center gap-2">
                <ScanLine size={18} /> عندك كود؟ ادخل به
              </span>
            </CtaButton>
          </div>
        </div>
      </AuthCard>
    </AuthShell>
  );
}

function mapErr(code: string, locale: 'ar' | 'en'): string {
  if (code === 'CONFLICT') return locale === 'ar' ? 'الحساب موجود بالفعل (اسم/بريد/جوال مستخدم)' : 'Account already exists';
  if (code === 'NOT_FOUND') return locale === 'ar' ? 'لا يوجد حساب بهذا الرقم — أنشئ حساباً' : 'No account for this number';
  if (code === 'VALIDATION_ERROR') return locale === 'ar' ? 'تحقّق من البيانات المُدخلة' : 'Check your details';
  return t(locale, 'error');
}
