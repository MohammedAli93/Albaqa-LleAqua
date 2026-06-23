import { useState } from 'react';
import { Sparkles, Check, ChevronRight } from 'lucide-react';
import { AVATARS, type PlayerProfile } from '@tahaddi/shared';
import { useStore } from '../../store.js';
import { Avatar } from '../../components/Avatar.js';
import { api } from '../../lib/config.js';
import { saveAccount, type Account } from '../../lib/account.js';
import { COUNTRIES } from '../../lib/catalog.js';
import { AuthShell, AuthCard, CtaButton } from './AuthShell.js';

/** Profile completion after registration — avatar + country, on the desert card.
 *  Full-bleed + responsive (mobile / desktop / TV); logic unchanged. */
export function Profile() {
  const { account, set } = useStore();
  const [avatarId, setAvatarId] = useState(account?.avatarId ?? AVATARS[0]!.id);
  const [country, setCountry] = useState<string | null>(account?.country ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ok = !!country;
  const returning = !!account?.country;

  async function finish() {
    if (!ok || !account || busy) return;
    setBusy(true); setErr(null);
    try {
      const updated = await api<PlayerProfile>('/api/v1/player/me', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${account.token}` },
        body: JSON.stringify({ country, avatarId }),
      });
      const full: Account = { ...updated, token: account.token };
      saveAccount(full);
      set({ account: full, nickname: full.username, avatarId, appView: 'home' });
    } catch {
      setErr('تعذّر الحفظ، حاول مجدداً');
      setBusy(false);
    }
  }

  const header = (
    <div className="text-center">
      <h1 className="font-display text-3xl font-black text-desert-ink sm:text-4xl">
        أهلاً {account?.username}
      </h1>
      <p className="mt-1 font-display font-bold text-desert-ink/60">اختر صورتك ودولتك</p>
    </div>
  );

  return (
    <AuthShell
      onBrand={() => set({ appView: 'home' })}
      navAction={
        returning ? (
          <button onClick={() => set({ appView: 'home' })} className="inline-flex items-center gap-1 transition hover:opacity-80">
            <ChevronRight size={16} /> رجوع
          </button>
        ) : (
          <span>إكمال الحساب</span>
        )
      }
    >
      <AuthCard header={header}>
        {/* Subscription status / upgrade entry */}
        {account?.paidUnlocked ? (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-white/70 px-4 py-3 font-display font-bold text-emerald-600 shadow-sm">
            <Check size={20} /> النسخة الكاملة مفعّلة
          </div>
        ) : (
          <button
            onClick={() => set({ appView: 'upgrade' })}
            className="mt-5 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-start text-white shadow-[0_14px_30px_-14px_rgba(214,90,20,0.8)] transition hover:brightness-105"
            style={{ backgroundImage: 'linear-gradient(135deg,#FBA94D,#EE5340)' }}
          >
            <Sparkles size={22} className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base font-black sm:text-lg">ترقية إلى النسخة الكاملة</span>
              <span className="block text-sm text-white/85">٣٥ سؤالاً + اختيار الفئات</span>
            </span>
            <ChevronRight size={20} className="shrink-0 rotate-180" />
          </button>
        )}

        {/* Avatar picker — square tiles, responsive grid */}
        <div className="mt-6">
          <p className="mb-2.5 text-right font-display font-bold text-white drop-shadow-sm">صورتك</p>
          <div className="grid grid-cols-5 gap-2.5 sm:grid-cols-8">
            {AVATARS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAvatarId(a.id)}
                className="grid aspect-square place-items-center transition active:scale-90"
                aria-label={a.labelAr}
              >
                <Avatar avatarId={a.id} size={52} shape="square" selected={a.id === avatarId} />
              </button>
            ))}
          </div>
        </div>

        {/* Country picker */}
        <div className="mt-6">
          <p className="mb-2.5 text-right font-display font-bold text-white drop-shadow-sm">دولتك</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {COUNTRIES.map((c) => {
              const selected = country === c.code;
              return (
                <button
                  key={c.code}
                  onClick={() => setCountry(c.code)}
                  className={[
                    'flex items-center gap-2 rounded-2xl px-3 py-2.5 text-right font-display font-bold transition',
                    selected
                      ? 'bg-white text-desert-ink ring-2 ring-[#E8473A]'
                      : 'bg-[#FFF7DF]/85 text-desert-ink/80 hover:bg-white',
                  ].join(' ')}
                >
                  <span className="text-xl">{c.flag}</span>
                  <span className="min-w-0 flex-1 truncate">{c.nameAr}</span>
                </button>
              );
            })}
          </div>
        </div>

        {err && <p className="mt-4 text-center font-bold text-[#B3160B]">{err}</p>}

        <div className="mt-7">
          <CtaButton onClick={finish} disabled={!ok || busy}>
            {busy ? '…' : 'ابدأ'}
          </CtaButton>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
