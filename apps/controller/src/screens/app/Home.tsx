import { motion } from 'framer-motion';
import {
  Trophy, Medal, LogOut, Play as PlayIcon, ScanLine,
  Dumbbell, Drama, Palette, Landmark, BookOpen, Globe2, Moon, Scale, FlaskConical,
  type LucideIcon,
} from 'lucide-react';
import { useStore } from '../../store.js';
import { Avatar } from '../../components/Avatar.js';
import { clearAccount } from '../../lib/account.js';
import { COUNTRIES, CATEGORIES } from '../../lib/catalog.js';

const CAT_ICON: Record<string, LucideIcon> = {
  sports: Dumbbell, culture: Drama, arts: Palette, history: Landmark, literature: BookOpen,
  geography: Globe2, arab: Moon, politics: Scale, science: FlaskConical, worldcup: Trophy,
};
const CAT_TINT = [
  'from-action/25 text-action', 'from-brand-cyan/25 text-brand-cyan',
  'from-brand-magenta/25 text-brand-magenta', 'from-prize-gold/25 text-prize-gold',
  'from-brand-indigo/25 text-brand-indigo',
];

export function Home() {
  const { account, set } = useStore();
  if (!account) return null;
  const country = COUNTRIES.find((c) => c.code === account.country);

  return (
    <div className="flex min-h-screen flex-col px-5 py-6">
      {/* Profile hero */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong relative overflow-hidden rounded-xl3 p-5"
      >
        <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-brand-violet/30 blur-2xl" />
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-gradient-brand opacity-60 blur-md" />
            <Avatar avatarId={account.avatarId} size={68} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl font-extrabold">{account.displayName}</span>
              {country && <span className="text-xl">{country.flag}</span>}
            </div>
            <span className="text-sm text-ink-muted">جاهز للتحدّي؟</span>
          </div>
          <button
            onClick={() => { clearAccount(); set({ account: null, appView: 'splash' }); }}
            className="text-ink-muted transition hover:text-ink-secondary"
            aria-label="تسجيل الخروج"
          >
            <LogOut size={20} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="glass flex items-center gap-3 rounded-xl2 px-4 py-3">
            <Trophy size={22} className="text-prize-gold" />
            <div>
              <div className="font-display text-2xl font-bold tnum leading-none">{account.leagueWins}</div>
              <div className="text-xs text-ink-muted">فوز بالدوري</div>
            </div>
          </div>
          <div className="glass flex items-center gap-3 rounded-xl2 px-4 py-3">
            <Medal size={22} className="text-brand-cyan" />
            <div>
              <div className="font-display text-2xl font-bold tnum leading-none">{account.cupWins}</div>
              <div className="text-xs text-ink-muted">فوز بالكأس</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Primary play */}
      <motion.button
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => set({ appView: 'play' })}
        className="btn-cta mt-5 flex w-full items-center justify-center gap-3 rounded-2xl py-6 text-3xl animate-glow-pulse"
      >
        <PlayIcon size={28} fill="white" /> العب الآن
      </motion.button>
      <button
        onClick={() => set({ appView: 'game', phase: 'join' })}
        className="glass mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-ink-secondary"
      >
        <ScanLine size={18} /> انضمّ بكود لعبة
      </button>

      {/* Categories */}
      <h2 className="mb-3 mt-8 font-display text-xl font-bold">الفئات</h2>
      <div className="grid grid-cols-2 gap-3 pb-6">
        {CATEGORIES.map((c, i) => {
          const Icon = CAT_ICON[c.id] ?? Trophy;
          return (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.04 * i }}
              whileTap={{ scale: 0.95 }}
              onClick={() => set({ appView: 'play' })}
              className={`relative overflow-hidden rounded-xl2 border border-white/10 bg-gradient-to-br ${CAT_TINT[i % CAT_TINT.length]} to-transparent p-4 text-start`}
            >
              <Icon size={26} />
              <span className="mt-3 block font-display text-lg font-bold text-ink-primary">{c.nameAr}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
