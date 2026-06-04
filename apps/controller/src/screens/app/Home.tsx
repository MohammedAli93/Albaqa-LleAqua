import { motion } from 'framer-motion';
import { Trophy, Medal, LogOut } from 'lucide-react';
import { useStore } from '../../store.js';
import { Avatar } from '../../components/Avatar.js';
import { clearAccount } from '../../lib/account.js';
import { COUNTRIES, CATEGORIES } from '../../lib/catalog.js';

export function Home() {
  const { account, set } = useStore();
  if (!account) return null;
  const country = COUNTRIES.find((c) => c.code === account.country);

  return (
    <div className="flex min-h-screen flex-col px-5 py-6">
      {/* Profile header */}
      <div className="glass flex items-center gap-4 rounded-xl3 p-4">
        <Avatar avatarId={account.avatarId} size={64} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-bold">{account.displayName}</span>
            {country && <span className="text-xl">{country.flag}</span>}
          </div>
          <div className="mt-1 flex gap-4 text-sm text-ink-secondary">
            <span className="flex items-center gap-1"><Trophy size={15} className="text-brand-gold" /> الدوري: {account.leagueWins}</span>
            <span className="flex items-center gap-1"><Medal size={15} className="text-brand-cyan" /> الكأس: {account.cupWins}</span>
          </div>
        </div>
        <button onClick={() => { clearAccount(); set({ account: null, appView: 'splash' }); }} className="text-ink-muted" aria-label="خروج">
          <LogOut size={20} />
        </button>
      </div>

      {/* Play CTA */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => set({ appView: 'play' })}
        className="mt-6 w-full rounded-2xl bg-gradient-brand py-6 font-display text-3xl font-black shadow-glow"
      >
        العب الآن
      </motion.button>
      <button
        onClick={() => set({ appView: 'game', phase: 'join' })}
        className="mt-3 w-full rounded-2xl glass py-3 text-lg font-semibold text-ink-secondary"
      >
        انضمّ بكود لعبة
      </button>

      {/* Categories */}
      <h2 className="mt-8 mb-3 font-display text-xl font-bold">الفئات</h2>
      <div className="grid grid-cols-2 gap-3 pb-6">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => set({ appView: 'play' })}
            className="glass flex items-center gap-3 rounded-xl2 p-4 text-start transition active:scale-95"
          >
            <span className="text-3xl">{c.icon}</span>
            <span className="font-display text-lg font-bold">{c.nameAr}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
