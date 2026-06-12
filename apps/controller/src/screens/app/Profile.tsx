import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Check, ChevronRight } from 'lucide-react';
import { AVATARS, type PlayerProfile } from '@tahaddi/shared';
import { useStore } from '../../store.js';
import { Avatar } from '../../components/Avatar.js';
import { api } from '../../lib/config.js';
import { saveAccount, type Account } from '../../lib/account.js';
import { COUNTRIES } from '../../lib/catalog.js';

/** Profile completion after registration: avatar + country. */
export function Profile() {
  const { account, set } = useStore();
  const [avatarId, setAvatarId] = useState(account?.avatarId ?? AVATARS[0]!.id);
  const [country, setCountry] = useState<string | null>(account?.country ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ok = !!country;

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

  return (
    <div className="flex min-h-dvh flex-col px-6 py-8">
      {account?.country && (
        <button
          onClick={() => set({ appView: 'home' })}
          className="mb-4 inline-flex items-center gap-1.5 self-start rounded-full bg-bg-sunken px-4 py-2 font-display text-sm font-bold text-ink-secondary"
        >
          <ChevronRight size={16} /> رجوع
        </button>
      )}
      <h1 className="font-display text-4xl font-bold text-gradient">
        أهلاً {account?.username}
      </h1>
      <p className="mt-2 text-ink-secondary">اختر صورتك ودولتك</p>

      {/* Subscription status — the always-available entry to the upgrade flow. */}
      {account?.paidUnlocked ? (
        <div className="mt-5 flex items-center gap-2 rounded-2xl bg-success/10 px-4 py-3 font-display font-bold text-success">
          <Check size={20} /> النسخة الكاملة مفعّلة
        </div>
      ) : (
        <button
          onClick={() => set({ appView: 'upgrade' })}
          className="mt-5 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-start text-white shadow-card"
          style={{ backgroundImage: 'linear-gradient(150deg,#F59E0B,#F43F5E)' }}
        >
          <Sparkles size={22} />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-black">ترقية إلى النسخة الكاملة</span>
            <span className="block text-sm text-white/85">٣٥ سؤالاً + اختيار الفئات</span>
          </span>
          <ChevronRight size={20} className="rotate-180" />
        </button>
      )}

      <div className="mt-6 space-y-6">
        <div>
          <p className="mb-3 text-ink-secondary">صورتك</p>
          <div className="grid grid-cols-4 gap-3">
            {AVATARS.map((a) => (
              <button key={a.id} onClick={() => setAvatarId(a.id)} className="grid place-items-center p-1" aria-label={a.labelAr}>
                <Avatar avatarId={a.id} size={58} selected={a.id === avatarId} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-ink-secondary">دولتك</p>
          <div className="grid grid-cols-2 gap-2">
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                onClick={() => setCountry(c.code)}
                className={[
                  'flex items-center gap-2 rounded-xl2 px-4 py-3 text-lg transition',
                  country === c.code ? 'bg-brand-deep/15 ring-2 ring-brand-deep' : 'glass',
                ].join(' ')}
              >
                <span className="text-2xl">{c.flag}</span> {c.nameAr}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 mt-8 bg-gradient-to-t from-bg-base to-transparent pb-2 pt-6">
        {err && <p className="mb-3 text-center text-danger">{err}</p>}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={finish}
          disabled={!ok || busy}
          className="w-full rounded-2xl bg-gradient-brand py-5 font-display text-2xl font-bold text-white shadow-glow disabled:opacity-40"
        >
          {busy ? '...' : 'ابدأ'}
        </motion.button>
      </div>
    </div>
  );
}
