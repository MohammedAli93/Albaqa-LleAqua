import { useState } from 'react';
import { motion } from 'framer-motion';
import { AVATARS, GAME_LIMITS } from '@tahaddi/shared';
import { useStore } from '../../store.js';
import { Avatar } from '../../components/Avatar.js';
import { api } from '../../lib/config.js';
import { saveAccount, type Account } from '../../lib/account.js';
import { COUNTRIES } from '../../lib/catalog.js';

/** First-time profile completion: name + avatar + country. */
export function Profile() {
  const { account, set } = useStore();
  const [name, setName] = useState(account?.displayName ?? '');
  const [avatarId, setAvatarId] = useState(account?.avatarId ?? AVATARS[0]!.id);
  const [country, setCountry] = useState<string | null>(account?.country ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ok = name.trim().length >= GAME_LIMITS.NICKNAME_MIN && !!country;

  async function finish() {
    if (!ok || !account || busy) return;
    setBusy(true); setErr(null);
    try {
      const updated = await api<Omit<Account, 'token'>>('/api/v1/player/me', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${account.token}` },
        body: JSON.stringify({ displayName: name.trim(), country, avatarId }),
      });
      const full: Account = { ...updated, token: account.token };
      saveAccount(full);
      set({ account: full, nickname: full.displayName, avatarId, appView: 'home' });
    } catch {
      setErr('تعذّر الحفظ، حاول مجدداً');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <h1 className="font-display text-4xl font-bold">أنشئ ملفّك</h1>

      <div className="mt-6 space-y-6">
        <div>
          <label className="mb-2 block text-ink-secondary">الاسم</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, GAME_LIMITS.NICKNAME_MAX))}
            dir="auto"
            className="w-full rounded-2xl glass px-5 py-4 text-2xl outline-none focus:ring-2 focus:ring-brand-violet"
            placeholder="اسمك"
          />
        </div>

        <div>
          <p className="mb-3 text-ink-secondary">الصورة الرمزية</p>
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
                  country === c.code ? 'bg-brand-violet/30 ring-2 ring-brand-violet' : 'glass',
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
          className="w-full rounded-2xl bg-gradient-brand py-5 font-display text-2xl font-bold shadow-glow disabled:opacity-40"
        >
          {busy ? '...' : 'ابدأ'}
        </motion.button>
      </div>
    </div>
  );
}
