import { motion } from 'framer-motion';
import {
  Trophy, Medal, LogOut, Play as PlayIcon, ScanLine, Tv, QrCode, Users, Coins, Swords,
  Dumbbell, Drama, Palette, Landmark, BookOpen, Globe2, Moon, Scale, FlaskConical,
  type LucideIcon,
} from 'lucide-react';
import { useStore } from '../../store.js';
import { Avatar } from '../../components/Avatar.js';
import { clearAccount } from '../../lib/account.js';
import { COUNTRIES, CATEGORIES } from '../../lib/catalog.js';

function Step({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-deep/10 text-brand-deep">
        <Icon size={16} />
      </span>
      <span className="leading-relaxed text-ink-secondary">{text}</span>
    </div>
  );
}

const CAT_ICON: Record<string, LucideIcon> = {
  sports: Dumbbell, culture: Drama, arts: Palette, history: Landmark, literature: BookOpen,
  geography: Globe2, arab: Moon, politics: Scale, science: FlaskConical, worldcup: Trophy,
};
export function Home() {
  const { account, set } = useStore();
  if (!account) return null;
  const country = COUNTRIES.find((c) => c.code === account.country);

  return (
    <div className="flex min-h-dvh flex-col px-5 py-6">
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
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-display text-2xl font-extrabold">{account.username}</span>
              {country && <span className="shrink-0 text-xl">{country.flag}</span>}
            </div>
            <span className="text-sm text-ink-muted">جاهز للتحدّي؟</span>
          </div>
          <button
            onClick={() => { clearAccount(); set({ account: null, appView: 'splash' }); }}
            className="-m-2.5 grid h-11 w-11 shrink-0 place-items-center text-ink-muted transition hover:text-ink-secondary"
            aria-label="تسجيل الخروج"
          >
            <LogOut size={20} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="glass flex items-center gap-3 rounded-xl2 px-4 py-3">
            <Trophy size={22} className="text-prize-gold" />
            <div>
              <div className="font-display text-2xl font-bold tnum leading-none">{account.pointsWins}</div>
              <div className="text-xs text-ink-muted">فوز بلعبة النقاط</div>
            </div>
          </div>
          <div className="glass flex items-center gap-3 rounded-xl2 px-4 py-3">
            <Medal size={22} className="text-brand-cyan" />
            <div>
              <div className="font-display text-2xl font-bold tnum leading-none">{account.eliminationWins}</div>
              <div className="text-xs text-ink-muted">فوز بلعبة التصفيات</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* What is this game / how it works */}
      <motion.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
        className="glass mt-5 rounded-xl3 p-5"
      >
        <h2 className="font-display text-xl font-extrabold">كيف نلعب؟</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
          لعبة أسئلة على شاشة كبيرة، وكل واحد يجاوب من جواله.
        </p>
        <div className="mt-4 space-y-2.5 text-sm">
          <Step icon={Tv} text="افتح اللعبة على شاشة كبيرة (تلفاز أو لابتوب)." />
          <Step icon={QrCode} text="كل واحد يمسح الكود من جواله ويدخل." />
          <Step icon={Users} text="فردي: كل واحد يلعب لنفسه، والأعلى نقاطًا يفوز." />
          <Step icon={Swords} text="فرق: تنقسمون فِرَق، والنقاط للفريق." />
          <Step icon={Coins} text="اجمعوا أكثر نقاط وتفوزون 🎉" />
        </div>
      </motion.section>

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
        <ScanLine size={18} /> عندك كود؟ ادخل به
      </button>

      {/* Categories — vibrant gradient tiles */}
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
              className="group relative h-28 overflow-hidden rounded-xl3 p-4 text-start text-white shadow-card transition"
              style={{ backgroundImage: `linear-gradient(145deg, ${c.gradient[0]} 0%, ${c.gradient[1]} 100%)` }}
            >
              {/* colorful emoji watermark + soft glow */}
              <span className="pointer-events-none absolute -right-2 -top-3 text-6xl opacity-25 transition group-hover:scale-110">
                {c.icon}
              </span>
              <span className="pointer-events-none absolute -bottom-8 -left-6 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
              <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <Icon size={22} />
              </span>
              <span className="relative mt-3 block font-display text-lg font-extrabold drop-shadow-sm">
                {c.nameAr}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
