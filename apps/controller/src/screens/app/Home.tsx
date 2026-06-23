import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, ScanLine, ChevronRight, ChevronLeft,
  Facebook, Instagram, Twitter, Linkedin, type LucideIcon,
} from 'lucide-react';
import { GameType, GameMode, GameTier } from '@tahaddi/shared';
import { useStore } from '../../store.js';
import { Avatar } from '../../components/Avatar.js';
import { clearAccount } from '../../lib/account.js';
import { COUNTRIES } from '../../lib/catalog.js';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  DESERT REDESIGN — pixel-faithful rebuild of the Figma comp "بقاء الأقوى1".
 *  Every illustration / decorative heading / logo is an exported Figma slice in
 *  /public/art (see README). The category tiles (cat-1…cat-10.png) are sliced
 *  1:1 from the comp, so they carry their own swirl + label. Interactive widgets
 *  (nav, buttons, chooser, inputs) are recreated in CSS+Cairo to stay crisp,
 *  responsive and functional. All game logic (chooser steps, launch(),
 *  join-by-code, free/paid tiers, auth) is unchanged from the previous Home.
 *
 *  Two illustrations are NOT yet exported and load gracefully (hidden until
 *  present): /art/hero-quad.png (quad-bike rider, hero right) and
 *  /art/news-camel.png (camel + rider, newsletter left).
 * ════════════════════════════════════════════════════════════════════════════
 */

const GOLD = '#F4C73C'; // brand gold — nav brand, newsletter heading, footer accents
const REDBTN = 'linear-gradient(180deg,#F2796C 0%,#E8473A 100%)'; // coral pill (العب الآن …)
const YELLOW = '#FFEA73'; // desert feature band

/** The 10 category tiles, sliced 1:1 from the comp (label baked into the art). */
const TILES = [
  { label: 'أدب', icon: '📖' },
  { label: 'تاريخ', icon: '🏛️' },
  { label: 'فنون', icon: '🎨' },
  { label: 'ثقافة', icon: '📚' },
  { label: 'رياضة', icon: '⚽' },
  { label: 'كأس العالم', icon: '🏆' },
  { label: 'علوم', icon: '🔬' },
  { label: 'الدين الإسلامي', icon: '🕌' },
  { label: 'الوطن العربي', icon: '🌍' },
  { label: 'جغرافيا', icon: '🗺️' },
].map((t, i) => ({ ...t, src: `/art/cat-${i + 1}.png` }));

/** The 4 "كيف نلعب؟" steps — text right, empty yellow placeholder square left. */
const STEPS = [
  'افتح اللعبة على شاشة كبيرة (تلفاز أو لابتوب).',
  'كل واحد يمسح الكود من جواله ويدخل.',
  'العبوا فردي أو فِرَق، وكل واحد يختار فئته.',
  'اجمعوا أكثر نقاط… والبقاء للأقوى.',
];

export function Home() {
  const { account, set } = useStore();
  const country = account ? COUNTRIES.find((c) => c.code === account.country) : undefined;
  // Three-step chooser: TYPE (فردي/فرق) → MODE (نقاط/تصفيات) → TIER (مجاني/كامل).
  // Both فردي and فِرَق now flow through the orange mode/tier panel.
  const [step, setStep] = useState<'type' | 'mode' | 'tier'>('type');
  const [pendingType, setPendingType] = useState<GameType>(GameType.INDIVIDUAL);
  const [pendingMode, setPendingMode] = useState<GameMode>(GameMode.POINTS);

  // Host a new game — runs in-app (one link): enter Host mode with the chosen
  // type + mode. Free games need no account; the PAID tier requires an unlocked host.
  function launch(type: GameType, mode: GameMode, tier?: GameTier) {
    if (tier === GameTier.PAID && !account?.paidUnlocked) {
      set({ appView: 'upgrade', hostLaunch: { type, mode, tier: GameTier.PAID } });
      return;
    }
    set({ appView: 'host', hostLaunch: { type, mode, tier } });
  }
  const joinByCode = () => set({ appView: 'game', phase: 'join' });
  const scrollToPlay = () =>
    document.getElementById('play')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="flex min-h-dvh flex-col bg-white text-desert-ink">
      {/* ─────────── Black top navbar ─────────── */}
      <header className="bg-desert-night">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-5 py-3 lg:px-8">
          <span className="font-display text-base font-extrabold tracking-wide lg:text-lg" style={{ color: GOLD }}>
            البقاء للأقوى
          </span>
          {account ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => set({ appView: 'profile' })}
                className="flex items-center gap-2 rounded-full bg-white/10 py-1 pe-3 ps-1 transition active:scale-95"
                aria-label="الملف الشخصي"
              >
                <Avatar avatarId={account.avatarId} size={26} />
                <span className="max-w-[7rem] truncate text-sm font-bold text-white">{account.username}</span>
                {country && <span className="text-sm">{country.flag}</span>}
              </button>
              <button
                onClick={() => { clearAccount(); set({ account: null }); }}
                className="grid h-8 w-8 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                aria-label="تسجيل الخروج"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => set({ appView: 'login' })}
              className="font-display text-sm font-bold transition hover:opacity-80 lg:text-base"
              style={{ color: GOLD }}
            >
              تسجيل الدخول
            </button>
          )}
        </div>
      </header>

      {/* ─────────── HERO — Figma "Group 280" gold half-moon mask ─────────── */}
      {/* The gold scenery AND both characters live in one wrapper that is clipped
          by the half-moon mask (hero-bg's own alpha), so the riders are cut by the
          dome curve instead of floating on white. mask-size:cover + bottom keeps the
          dome undistorted at any height, so we can freely shrink the hero. */}
      {/* Height is capped (clamp) so the hero doesn't balloon on 2K/ultrawide; the
          characters live in a CENTRED max-width row so on wide screens they hug the
          middle (where the dome is tall) instead of the cut-away corners. */}
      <section className="relative isolate h-[clamp(19rem,34vw,33rem)] w-full overflow-hidden bg-white">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            WebkitMaskImage: 'url(/art/hero-bg.png)', maskImage: 'url(/art/hero-bg.png)',
            WebkitMaskSize: 'cover', maskSize: 'cover',
            WebkitMaskPosition: 'bottom', maskPosition: 'bottom',
            WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
          }}
        >
          {/* gold scenery */}
          <img src="/art/hero-bg.png" alt="" aria-hidden className="absolute inset-0 h-full w-full select-none object-cover object-bottom" />
          {/* characters anchored to a centred row so they stay on the dome on any width */}
          <div className="relative mx-auto h-full w-full max-w-[1200px]">
            {/* camel + rider — hero left (gently floats; smaller/higher/inset on phones) */}
            <Art src="/art/hero-rider.png" alt="" className="absolute bottom-[20%] end-[2%] w-[6rem] animate-float sm:bottom-[10%] sm:end-0 sm:w-[9rem] md:w-[13rem] lg:w-[15rem]" />
            {/* quad-bike rider — hero right (floats out of sync) */}
            <Art src="/art/hero-quad.png" alt="" className="absolute bottom-[20%] start-[2%] w-[7rem] animate-float [animation-delay:1.4s] sm:bottom-[8%] sm:start-0 sm:w-[10.5rem] md:w-[15rem] lg:w-[17rem]" />
          </div>
        </div>

        <div className="absolute inset-0 z-10 mx-auto flex w-full max-w-[1240px] items-center justify-center px-5 lg:px-8">
          {/* centered hero column */}
          <div className="relative z-10 -mt-1 flex flex-col items-center justify-center text-center">
            <Art src="/art/eyebrow.png" alt="برنامج المسابقات الأول"
              className="h-auto w-[10rem] sm:w-[12rem]" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 180, damping: 16 }}
              className="mt-3"
            >
              <Art src="/art/logo-wordmark.png" alt="البقاء للأقوى"
                className="mx-auto h-auto w-[19rem] sm:w-[24rem] lg:w-[30rem]" />
            </motion.div>

            <motion.button
              onClick={scrollToPlay}
              animate={{ scale: [1, 1.045, 1] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              whileHover={{ scale: 1.08, y: -2 }} whileTap={{ scale: 0.96 }}
              className="mt-5 rounded-full px-9 py-2.5 font-display text-base font-bold text-white shadow-[0_10px_28px_-8px_rgba(232,71,58,0.85)] sm:text-lg"
              style={{ backgroundImage: REDBTN }}
            >
              العب الآن
            </motion.button>

            <Art src="/art/hero-sub.png" alt="لتجربة أجمل العبها على شاشة التلفزيون"
              className="mt-5 h-auto w-[11rem] sm:w-[13rem]" />
          </div>
        </div>
      </section>

      {/* ─────────── Start a new game (white) — the logic chooser ─────────── */}
      <section id="play" className="scroll-mt-4 bg-white px-5 pb-14 pt-8 sm:pb-20 sm:pt-12 lg:px-8">
        <div className="mx-auto w-full max-w-[620px]">
          {/* section title stays above the chooser on every step */}
          <div className="text-center">
            <Art src="/art/title-start.png" alt="ابدأ لعبة جديدة" className="mx-auto h-auto w-[15rem] sm:w-[18rem]" />
            <Art src="/art/sub-start.png" alt="العبوا فردي أو فِرَق على الشاشة الكبيرة." className="mx-auto mt-3 h-auto w-[16rem] sm:w-[20rem]" />
          </div>

          <AnimatePresence mode="wait">
            {step === 'type' ? (
              <motion.div
                key="type"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="mt-7 grid grid-cols-2 gap-5 sm:gap-7"
              >
                {/* فردي (right, orange) → mode panel */}
                <CardArt src="/art/card-fardi.png" alt="فردي — فز عليهم لحالك"
                  onClick={() => { setPendingType(GameType.INDIVIDUAL); setStep('mode'); }} />
                {/* فِرَق (left, yellow) → mode panel */}
                <CardArt src="/art/card-firaq.png" alt="فِرَق — جمّع اخوياك واهزموهم"
                  onClick={() => { setPendingType(GameType.TEAMS); setStep('mode'); }} />
              </motion.div>
            ) : step === 'mode' ? (
              <ChooserPanel
                key="mode" title="اختر نوع اللعبة"
                subtitle="كل واحد يجمع نقاط، أو يلعبها تصفية والبقاء للأقوى." onBack={() => setStep('type')}
              >
                <PanelRow title="نقاط" desc="اجمع أكثر نقاط وتفوز"
                  onClick={() => { setPendingMode(GameMode.POINTS); setStep('tier'); }} />
                <PanelRow title="تصفيات" desc="كل خطأ يقرّبك للخروج — والبقاء للأقوى"
                  onClick={() => { setPendingMode(GameMode.ELIMINATION); setStep('tier'); }} />
              </ChooserPanel>
            ) : (
              <ChooserPanel
                key="tier" title="اختر النسخة"
                subtitle="النسخة المجانية ١٥ سؤالاً، أو الكاملة ٣٥ سؤالاً مع اختيار الفئات." onBack={() => setStep('mode')}
              >
                <PanelRow title="النسخة المجانية" desc="١٥ سؤالاً متنوّعاً — ابدأ فوراً"
                  onClick={() => launch(pendingType, pendingMode, GameTier.FREE)} />
                <PanelRow title="النسخة الكاملة"
                  desc={account?.paidUnlocked ? '٣٥ سؤالاً + اختيار الفئات — مفعّلة ✓' : '٣٥ سؤالاً + اختيار الفئات — للترقية'}
                  onClick={() => launch(pendingType, pendingMode, GameTier.PAID)} />
              </ChooserPanel>
            )}
          </AnimatePresence>

          <div className="mt-7 flex justify-center">
            <PillButton onClick={joinByCode}>
              <ScanLine size={17} className="opacity-90" /> عندك كود؟ ادخل به
            </PillButton>
          </div>
        </div>
      </section>

      {/* ─────────── Jeep climbing the dune — bridges white → yellow ─────────── */}
      <div className="relative bg-white pt-10">
        {/* dune (Figma "Group 148"): its flat yellow base lines up with the yellow band */}
        <img src="/art/dune.png" alt="" aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-0 w-full select-none" />
        <Art src="/art/jeep.png" alt="" className="relative z-10 mx-auto block h-auto w-[78%] max-w-[560px] pb-1" />
      </div>

      {/* ═══════ Yellow feature band — categories + how-to ═══════ */}
      {/* -mt-px overlaps the white/yellow boundary by 1px to swallow the seam line */}
      <section style={{ backgroundColor: YELLOW }} className="relative -mt-px pb-12 pt-10">
        {/* استكشف الفئات */}
        <div className="mx-auto w-full max-w-[1240px] px-5 lg:px-8">
          <Art src="/art/title-categories.png" alt="استكشف الفئات" className="mx-auto h-auto w-[15rem] sm:w-[19rem]" />
          <div dir="ltr" className="mx-auto mt-8 grid max-w-[1252px] grid-cols-3 gap-x-5 gap-y-6 sm:grid-cols-4 lg:grid-cols-5 lg:gap-x-[34px] lg:gap-y-8">
            {TILES.map((t, i) => (
              <motion.button
                key={t.label}
                initial={{ opacity: 0, scale: 0.92 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                transition={{ delay: 0.025 * i, type: 'spring', stiffness: 240, damping: 18 }}
                whileHover={{ y: -7, scale: 1.05, rotate: -1.5 }}
                whileTap={{ scale: 0.95 }}
                onClick={scrollToPlay}
                aria-label={t.label}
                className="relative block w-full overflow-hidden rounded-[1.6rem] shadow-[0_14px_30px_-18px_rgba(0,0,0,0.4)]"
              >
                <img src={t.src} alt={t.label} loading="eager" decoding="async" className="block h-auto w-full" />
                {/* category logo, centered on the tile's icon plate */}
                <CatIcon emoji={t.icon} />
              </motion.button>
            ))}
          </div>
        </div>

        {/* كيف نلعب؟ — title's luggage/drum rest on the top edge of the four boxes */}
        <div className="mx-auto mt-16 w-full max-w-[1240px] px-5 lg:px-8">
          <Art src="/art/title-howto.png" alt="كيف نلعب؟" className="relative z-10 mx-auto h-auto w-full max-w-[680px] sm:max-w-[760px]" />
          <div className="-mt-3 grid gap-6 sm:grid-cols-2 lg:-mt-5 lg:gap-8">
            {STEPS.map((text) => (
              <div key={text} className="flex items-center gap-5 rounded-[1.5rem] bg-white p-6 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.4)] sm:p-7">
                {/* icon plate (right) */}
                <span aria-hidden className="h-20 w-20 shrink-0 rounded-2xl sm:h-24 sm:w-24" style={{ backgroundColor: '#FCE08A' }} />
                {/* step text fills the rest, right-aligned */}
                <p className="flex-1 text-start text-base font-bold leading-relaxed text-desert-ink sm:text-lg">{text}</p>
              </div>
            ))}
          </div>

          {!account && (
            <div className="mt-10 flex justify-center">
              <PillButton onClick={() => set({ appView: 'login' })} large>
                سجّل دخولك لحفظ نقاطك وانتصاراتك
              </PillButton>
            </div>
          )}
          <p className="mt-5 text-center text-sm leading-relaxed text-desert-ink/55">
            افتح اللعبة على الشاشة الكبيرة، ثم كل لاعب يمسح الكود ويختار فئته.
          </p>
        </div>
      </section>

      {/* walking camels straddle the boundary: the yellow fills up to the camels'
          ground surface, white below — so the desert ends exactly at their feet. */}
      <div className="relative bg-white">
        <div className="absolute inset-x-0 top-0 h-[46%]" style={{ backgroundColor: YELLOW }} aria-hidden />
        <Art src="/art/camels.png" alt="" className="relative h-auto w-full" />
      </div>

      {/* ═══════ Dark newsletter + footer ═══════ */}
      <NewsletterBand />
      <SiteFooter />
    </div>
  );
}

/** Exported-asset loader — renders a Figma slice and gracefully removes itself
 *  if the file isn't present yet, so the layout stays correct before art lands. */
function Art({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img src={src} alt={alt} loading="eager" decoding="async" onError={() => setFailed(true)} className={className} />;
}

/** Twemoji = open-source flat *illustration* of an emoji (crisp colour SVG), a more
 *  logo-like category icon than the OS glyph. Build the CDN path from codepoints. */
function twemojiUrl(emoji: string): string {
  const cps = [...emoji].map((ch) => ch.codePointAt(0)!);
  const hasZwj = cps.includes(0x200d);
  const code = (hasZwj ? cps : cps.filter((cp) => cp !== 0xfe0f)).map((cp) => cp.toString(16)).join('-');
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${code}.svg`;
}

/** Category logo, centred on the tile's icon plate (Twemoji, OS-emoji fallback). */
function CatIcon({ emoji }: { emoji: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-[38%] grid -translate-x-1/2 -translate-y-1/2 place-items-center"
    >
      {failed ? (
        <span className="text-3xl sm:text-4xl lg:text-[2.6rem]">{emoji}</span>
      ) : (
        <img
          src={twemojiUrl(emoji)} alt="" loading="eager" decoding="async" onError={() => setFailed(true)}
          className="h-9 w-9 drop-shadow-sm sm:h-11 sm:w-11 lg:h-[2.9rem] lg:w-[2.9rem]"
        />
      )}
    </span>
  );
}

/** فردي / فِرَق card — the baked Figma slice, made into a tappable button. */
function CardArt({ src, alt, onClick }: { src: string; alt: string; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ y: -6, scale: 1.02 }} whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 320, damping: 20 }}
      onClick={onClick} aria-label={alt}
      className="block w-full overflow-hidden rounded-[1.5rem] shadow-[0_22px_50px_-30px_rgba(0,0,0,0.45)]"
    >
      <img src={src} alt={alt} className="block h-auto w-full" />
    </motion.button>
  );
}

/** Coral pill button (العب الآن / عندك كود / سجّل دخولك) — recreated in CSS. */
function PillButton({ children, onClick, large }: { children: React.ReactNode; onClick: () => void; large?: boolean }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 360, damping: 18 }}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-display font-bold text-white shadow-[0_12px_26px_-12px_rgba(232,71,58,0.85)] ${
        large ? 'px-8 py-3.5 text-base sm:text-lg' : 'px-7 py-3 text-sm sm:text-base'
      }`}
      style={{ backgroundImage: REDBTN }}
    >
      {children}
    </motion.button>
  );
}

/** Orange chooser panel (mode / tier steps) — Figma "Group 146": orange→cream
 *  gradient, gold رجوع pill, cream rows. Pops in with a spring; rows stagger. */
function ChooserPanel({
  title, subtitle, onBack, children,
}: { title: string; subtitle: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 230, damping: 23 }}
      className="mt-7 overflow-hidden rounded-[1.75rem] p-5 shadow-[0_28px_64px_-30px_rgba(214,90,20,0.55)] sm:p-7"
      style={{ backgroundImage: 'linear-gradient(180deg,#FB8B14 0%,#FCA13D 45%,#FFE7CF 100%)' }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* header on the RIGHT (RTL start) */}
        <div className="text-right">
          <h2 className="font-display text-2xl font-black text-desert-ink sm:text-[1.75rem]">{title}</h2>
          <p className="mt-1 text-sm font-semibold leading-snug text-white/80">{subtitle}</p>
        </div>
        {/* رجوع on the LEFT (RTL end) */}
        <motion.button
          whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
          onClick={onBack}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-4 py-1.5 font-display text-sm font-bold text-desert-ink shadow-[0_6px_14px_-6px_rgba(214,150,0,0.7)]"
          style={{ backgroundImage: 'linear-gradient(180deg,#FFE75D 0%,#FFCB12 100%)' }}
        >
          <ChevronRight size={15} /> رجوع
        </motion.button>
      </div>
      <motion.div
        className="mt-5 space-y-3"
        initial="hidden" animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** A cream row inside the orange ChooserPanel. */
function PanelRow({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <motion.button
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      whileHover={{ x: -5 }} whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl bg-white/70 p-4 text-right shadow-sm backdrop-blur-sm transition hover:bg-white"
    >
      {/* text on the RIGHT (RTL start) */}
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-extrabold text-desert-ink">{title}</span>
        <span className="mt-0.5 block text-sm leading-snug text-desert-ink/55">{desc}</span>
      </span>
      {/* chevron on the LEFT (RTL end) */}
      <ChevronLeft size={20} className="shrink-0 text-desert-ink/30 transition group-hover:-translate-x-1 group-hover:text-desert-coral" />
    </motion.button>
  );
}

/** "ابقَ على اطلاع" — the complete dark newsletter band (Figma "Group 280 (1)",
 *  camel + heading + email field baked in). Rendered on white before the footer. */
function NewsletterBand() {
  return (
    <section className="bg-white px-5 py-12 lg:px-8">
      <img
        src="/art/newsletter.png"
        alt="ابقَ على اطلاع — اشترك ليصلك كل جديد من المسابقات والتحديثات"
        className="mx-auto block h-auto w-full max-w-[1240px]"
      />
    </section>
  );
}

/** Footer — brand logo, link columns, gold socials, copyright (Figma "Group 281"). */
function SiteFooter() {
  return (
    <footer className="bg-desert-night px-5 pb-8 pt-12 text-white/80 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1240px] gap-10 pb-12 sm:grid-cols-2 lg:grid-cols-3">
        {/* brand column (right in RTL) — our logo replaces the "LOGO" placeholder */}
        <div>
          <img src="/art/logo-wordmark.png" alt="البقاء للأقوى" className="h-11 w-auto sm:h-12" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
            برنامج المسابقات الأول — العبوا مع العائلة والأصدقاء على الشاشة الكبيرة.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <SocialIcon icon={Facebook} label="فيسبوك" />
            <SocialIcon icon={Instagram} label="إنستغرام" />
            <SocialIcon icon={Twitter} label="إكس" />
            <SocialIcon icon={Linkedin} label="لينكدإن" />
          </div>
        </div>
        <FooterCol title="اتصل بنا" links={['تواصلوا معنا لأي استفسار حول المسابقات والاشتراكات.', 'support@albaqaa.app']} />
        <FooterCol title="عنّا" links={['من نحن', 'النسخة الكاملة', 'الوظائف', 'اتصل بنا']} />
      </div>
      <div
        className="mx-auto w-full max-w-[1240px] border-t pt-6 text-center text-xs text-white/45"
        style={{ borderTopColor: GOLD }}
      >
        حقوق النشر © ٢٠٢٦ البقاء للأقوى. جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div className="text-start">
      <h4 className="font-display text-base font-bold" style={{ color: GOLD }}>{title}</h4>
      <ul className="mt-4 space-y-3 text-sm text-white/55">
        {links.map((l) => (
          <li key={l}><a href="#" className="leading-relaxed transition hover:text-white">{l}</a></li>
        ))}
      </ul>
    </div>
  );
}

function SocialIcon({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <a
      href="#" aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full text-desert-night transition hover:opacity-80"
      style={{ backgroundColor: GOLD }}
    >
      <Icon size={16} />
    </a>
  );
}
