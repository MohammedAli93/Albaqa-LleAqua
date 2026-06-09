import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Medal, LogOut, Play as PlayIcon, ScanLine, Tv, QrCode, Users, Coins, Swords,
  Sparkles, LogIn, User, ChevronRight, type LucideIcon,
} from 'lucide-react';
import { GameType, GameMode } from '@tahaddi/shared';
import { useStore } from '../../store.js';
import { Avatar } from '../../components/Avatar.js';
import { clearAccount } from '../../lib/account.js';
import { SCREEN_URL } from '../../lib/config.js';
import { COUNTRIES, CATEGORIES } from '../../lib/catalog.js';

export function Home() {
  const { account, set } = useStore();
  const country = account ? COUNTRIES.find((c) => c.code === account.country) : undefined;
  // Two-step chooser: pick TYPE (فردي/فرق); فردي then picks MODE (نقاط/تصفيات).
  const [step, setStep] = useState<'type' | 'mode'>('type');

  // Host a new game on the big screen (or fall back to join-by-code on phone).
  // No account required — players name themselves when they join.
  function launch(type: GameType, mode: GameMode) {
    const params = new URLSearchParams({ type, mode });
    if (SCREEN_URL) window.open(`${SCREEN_URL}/?${params.toString()}`, '_blank');
    else set({ appView: 'game', phase: 'join' });
  }
  const joinByCode = () => set({ appView: 'game', phase: 'join' });
  const scrollToPlay = () =>
    document.getElementById('play')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="flex min-h-dvh flex-col pb-12">
      {/* ─────────── Top navbar ─────────── */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
        <span className="font-display text-xl font-black text-gradient lg:text-2xl">البقاء للأقوى</span>
        {account ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-bg-raised/80 py-1 pe-3 ps-1 shadow-glass">
              <Avatar avatarId={account.avatarId} size={30} />
              <span className="max-w-[7rem] truncate text-sm font-bold">{account.username}</span>
              {country && <span className="text-sm">{country.flag}</span>}
            </div>
            <button
              onClick={() => { clearAccount(); set({ account: null }); }}
              className="grid h-9 w-9 place-items-center rounded-full text-ink-muted transition hover:bg-bg-sunken hover:text-ink-secondary"
              aria-label="تسجيل الخروج"
            >
              <LogOut size={17} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => set({ appView: 'login' })}
            className="flex items-center gap-1.5 rounded-full bg-brand-deep px-4 py-2 text-sm font-bold text-white shadow-glow transition active:scale-95 lg:px-5 lg:py-2.5 lg:text-base"
          >
            <LogIn size={15} /> تسجيل الدخول
          </button>
        )}
      </header>

      {/* ─────────── HERO (bold gradient, full-bleed responsive) ─────────── */}
      <section
        className="relative overflow-hidden px-6 pb-32 pt-10 text-center text-white lg:pb-40 lg:pt-16"
        style={{ backgroundImage: 'linear-gradient(165deg, #4F46E5 0%, #6D28D9 48%, #DB2777 100%)' }}
      >
        <div className="pointer-events-none absolute -right-12 -top-10 h-44 w-44 rounded-full bg-white/15 blur-3xl lg:h-72 lg:w-72" />
        <div className="pointer-events-none absolute -left-14 top-1/3 h-48 w-48 rounded-full bg-action/30 blur-3xl lg:h-80 lg:w-80" />
        <Sparkles className="pointer-events-none absolute left-6 top-10 animate-float text-white/70 lg:left-20 lg:top-20" size={22} />
        <Trophy className="pointer-events-none absolute right-7 top-24 animate-float text-prize-gold lg:right-24" size={20} style={{ animationDelay: '1.2s' }} />

        <div className="relative mx-auto max-w-3xl">
          <motion.span
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold backdrop-blur lg:text-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-prize-gold animate-pulse-glow" /> برنامج المسابقات الأول
          </motion.span>

          <motion.h1
            initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 190, damping: 16 }}
            className="mt-4 font-display text-[3.7rem] font-black leading-[1.08] drop-shadow-lg sm:text-7xl lg:text-[7.5rem]"
          >
            البقاء للأقوى
          </motion.h1>
          <p className="mx-auto mt-3 max-w-[18rem] font-display text-lg font-bold leading-relaxed text-white/90 sm:max-w-md sm:text-2xl">
            الجواب عليك، والسؤال علينا 🎯
          </p>
          <p className="mx-auto mt-1 max-w-[18rem] text-sm text-white/75 sm:max-w-lg sm:text-base">
            +50 فئة · أسئلة لا تنتهي · العبوها مع أصحابكم على الشاشة الكبيرة
          </p>

          <motion.button
            whileTap={{ scale: 0.97 }} onClick={scrollToPlay}
            className="mt-7 inline-flex items-center justify-center gap-2.5 rounded-2xl bg-white px-10 py-4 font-display text-2xl font-black text-brand-deep shadow-xl transition lg:px-14 lg:py-5 lg:text-3xl"
          >
            <PlayIcon size={24} fill="currentColor" /> العب الآن
          </motion.button>

          {account && (
            <div className="mx-auto mt-7 grid max-w-xs grid-cols-2 gap-3 sm:max-w-sm">
              <Stat icon={Trophy} value={account.pointsWins} label="فوز نقاط" />
              <Stat icon={Medal} value={account.eliminationWins} label="فوز تصفيات" />
            </div>
          )}
        </div>
      </section>

      {/* ─────────── Game chooser (2-step) — overlaps the hero ─────────── */}
      <section id="play" className="relative z-10 mx-auto -mt-24 w-full max-w-3xl scroll-mt-4 px-5 lg:-mt-28 lg:px-8">
        <div className="glass-strong rounded-xl4 p-5 shadow-card sm:p-7">
          <div className="mb-1 flex items-center gap-2">
            <span className="h-7 w-1.5 rounded-full bg-gradient-action" />
            <h2 className="font-display text-2xl font-black sm:text-3xl">
              {step === 'type' ? 'ابدأ لعبة جديدة' : 'اختر نوع اللعبة'}
            </h2>
          </div>
          <p className="mb-5 ps-3.5 text-sm text-ink-secondary">
            {step === 'type' ? 'العبوا فردي أو فِرَق على الشاشة الكبيرة.' : 'كل واحد يجمع نقاط، أو يلعبها تصفية والبقاء للأقوى.'}
          </p>

          <AnimatePresence mode="wait">
            {step === 'type' ? (
              <motion.div
                key="type"
                initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-2 gap-3 sm:gap-4"
              >
                <BigCard
                  icon={User} title="فردي" tagline="فز عليهم لحالك 😎"
                  grad="linear-gradient(150deg,#6366F1,#4F46E5)" onClick={() => setStep('mode')}
                />
                <BigCard
                  icon={Users} title="فِرَق" tagline="جمّع اخوياك واهزموهم 💪🏻"
                  grad="linear-gradient(150deg,#FB7185,#F43F5E)" onClick={() => launch(GameType.TEAMS, GameMode.POINTS)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="mode"
                initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <button
                  onClick={() => setStep('type')}
                  className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-bg-sunken px-4 py-2 font-display text-sm font-bold text-ink-secondary"
                >
                  <ChevronRight size={16} /> رجوع
                </button>
                <ModeRow
                  icon={Coins} title="نقاط" desc="اجمع أكثر نقاط وتفوز" tint="from-brand-deep/12 text-brand-deep"
                  onClick={() => launch(GameType.INDIVIDUAL, GameMode.POINTS)}
                />
                <ModeRow
                  icon={Swords} title="تصفيات" desc="كل خطأ يقرّبك للخروج — والبقاء للأقوى" tint="from-action/12 text-action"
                  onClick={() => launch(GameType.INDIVIDUAL, GameMode.ELIMINATION)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={joinByCode}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-bg-sunken py-3.5 font-semibold text-ink-secondary transition hover:bg-bg-sunken/70"
          >
            <ScanLine size={18} /> عندك كود؟ ادخل به
          </button>
        </div>
      </section>

      {/* ─────────── Categories showcase (image-backed) ─────────── */}
      <section className="mx-auto mt-10 w-full max-w-6xl px-5 lg:px-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl font-extrabold sm:text-2xl">استكشف الفئات</h2>
          <span className="text-xs text-ink-muted sm:text-sm">+50 فئة</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c, i) => (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.03 * i, type: 'spring', stiffness: 240, damping: 18 }}
              whileTap={{ scale: 0.95 }}
              onClick={scrollToPlay}
              className="group relative aspect-square overflow-hidden rounded-[1.6rem] shadow-card ring-1 ring-black/5"
              style={{ backgroundImage: `linear-gradient(150deg, ${c.gradient[0]} 0%, ${c.gradient[1]} 100%)` }}
            >
              {/* cartoon sunburst rays */}
              <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.13]"
                style={{ background: 'repeating-conic-gradient(from 0deg at 50% 40%, #fff 0deg 7deg, transparent 7deg 14deg)' }} />
              {/* glossy top sheen */}
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
              {/* confetti dots */}
              <span aria-hidden className="pointer-events-none absolute left-4 top-4 h-2.5 w-2.5 rounded-full bg-white/55" />
              <span aria-hidden className="pointer-events-none absolute right-5 top-7 h-1.5 w-1.5 rounded-full bg-white/45" />
              <span aria-hidden className="pointer-events-none absolute bottom-16 left-6 h-1.5 w-1.5 rounded-full bg-white/35" />
              {/* big cartoon sticker (Twemoji illustration, emoji fallback) */}
              <span
                className="absolute inset-x-0 top-[13%] grid place-items-center transition duration-300 group-active:scale-110 group-active:-rotate-6"
                style={{ filter: 'drop-shadow(0 6px 5px rgba(0,0,0,0.25))' }}
              >
                <EmojiArt emoji={c.icon} />
              </span>
              {/* bold label band */}
              <span className="absolute inset-x-2.5 bottom-2.5 rounded-2xl bg-white/92 py-1.5 text-center font-display text-base font-black text-ink-primary shadow-sm sm:text-lg">
                {c.nameAr}
              </span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ─────────── How it works ─────────── */}
      <section className="mx-auto mt-10 w-full max-w-3xl px-5 lg:px-8">
        <div className="glass rounded-xl3 p-5 sm:p-7">
          <h2 className="font-display text-xl font-extrabold sm:text-2xl">كيف نلعب؟</h2>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 sm:text-base">
            <Step icon={Tv} tint="bg-brand-deep/10 text-brand-deep" text="افتح اللعبة على شاشة كبيرة (تلفاز أو لابتوب)." />
            <Step icon={QrCode} tint="bg-brand-cyan/12 text-brand-cyan" text="كل واحد يمسح الكود من جواله ويدخل." />
            <Step icon={Users} tint="bg-action/12 text-action" text="العبوا فردي أو فرق، وكل واحد يختار فئته." />
            <Step icon={Coins} tint="bg-prize-gold/12 text-prize-deep" text="اجمعوا أكثر نقاط… والبقاء للأقوى 🏆" />
          </div>
        </div>

        {!account && (
          <button
            onClick={() => set({ appView: 'login' })}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-brand py-4 font-display text-lg font-bold text-white shadow-glow"
          >
            <LogIn size={18} /> سجّل دخولك لحفظ نقاطك وانتصاراتك
          </button>
        )}
        <p className="mt-4 text-center text-xs leading-relaxed text-ink-muted">
          افتح اللعبة على الشاشة الكبيرة، ثم كل لاعب يمسح الكود ويختار فئته.
        </p>
      </section>
    </div>
  );
}

function BigCard({
  icon: Icon, title, tagline, grad, onClick,
}: {
  icon: LucideIcon; title: string; tagline: string; grad: string; onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group relative flex aspect-[4/5] flex-col items-center justify-center gap-3 overflow-hidden rounded-[1.6rem] p-4 text-center text-white shadow-card sm:aspect-[5/4]"
      style={{ backgroundImage: grad }}
    >
      <span className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/15 blur-xl" />
      <span className="grid h-16 w-16 place-items-center rounded-3xl bg-white/20 backdrop-blur-sm">
        <Icon size={30} strokeWidth={2.3} />
      </span>
      <span className="font-display text-2xl font-black drop-shadow sm:text-3xl">{title}</span>
      <span className="text-xs font-semibold text-white/85 sm:text-sm">{tagline}</span>
    </motion.button>
  );
}

function ModeRow({
  icon: Icon, title, desc, tint, onClick,
}: {
  icon: LucideIcon; title: string; desc: string; tint: string; onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`glass flex w-full items-center gap-4 rounded-xl3 bg-gradient-to-l ${tint} to-white p-4 text-start shadow-card transition active:shadow-glow`}
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white shadow-glass">
        <Icon size={26} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl font-extrabold text-ink-primary">{title}</span>
        <span className="mt-0.5 block text-sm leading-snug text-ink-secondary">{desc}</span>
      </span>
      <ChevronRight size={22} className="shrink-0 rotate-180 text-ink-muted" />
    </motion.button>
  );
}

/** Twemoji = the open-source, flat *cartoon* illustration of an emoji (real SVG
 *  files). Build the CDN path from the emoji's codepoints (dropping the FE0F
 *  variation selector, like Twemoji itself does for non-ZWJ glyphs). */
function twemojiUrl(emoji: string): string {
  const cps = [...emoji].map((ch) => ch.codePointAt(0)!);
  const hasZwj = cps.includes(0x200d);
  const code = (hasZwj ? cps : cps.filter((cp) => cp !== 0xfe0f))
    .map((cp) => cp.toString(16))
    .join('-');
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${code}.svg`;
}

/** Crisp cartoon illustration of the category, falling back to the OS emoji. */
function EmojiArt({ emoji }: { emoji: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="text-[3.3rem] leading-none sm:text-6xl">{emoji}</span>;
  return (
    <img
      src={twemojiUrl(emoji)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-16 w-16 sm:h-[5.5rem] sm:w-[5.5rem]"
    />
  );
}

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 rounded-xl2 bg-white/15 px-3 py-2.5 backdrop-blur">
      <Icon size={20} className="text-prize-gold" />
      <div className="text-start">
        <div className="font-display text-xl font-bold tnum leading-none">{value}</div>
        <div className="text-[0.7rem] text-white/75">{label}</div>
      </div>
    </div>
  );
}

function Step({ icon: Icon, text, tint }: { icon: LucideIcon; text: string; tint: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl2 ${tint}`}>
        <Icon size={18} />
      </span>
      <span className="leading-relaxed text-ink-secondary">{text}</span>
    </div>
  );
}
