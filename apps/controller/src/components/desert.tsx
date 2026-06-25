import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { getAvatar } from '@tahaddi/shared';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  DESERT GAME KIT — the new "البقاء للأقوى" in-game design language, rebuilt
 *  pixel-faithful from the client reference set (Assets/References/*). One sky
 *  plate (host-bg-sky.jpg blue / host-bg-team.jpg sand), a black top bar, and a
 *  glossy yellow card with vivid candy pills, orange squircle tiles and gold
 *  headings. Shared by every in-game phone screen so the look is consistent.
 * ════════════════════════════════════════════════════════════════════════════
 */

export const GOLD = '#F4C73C';

/** Yellow card surface — glossy top sheen + warm gradient (ref cards). */
export const CARD_BG =
  'radial-gradient(125% 80% at 50% -12%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 55%),' +
  'linear-gradient(158deg,#FCEE5F 0%,#F8DE34 46%,#F3CC13 100%)';

/** Orange squircle tile (avatar / timer / countdown). */
export const TILE_BG = 'linear-gradient(160deg,#FFAE3C 0%,#FB7C1C 100%)';

/** Candy gradients per pill colour. */
export const PILLS = {
  blue: { fill: 'linear-gradient(180deg,#5BA8F5 0%,#3C84E8 100%)', chip: '#9CC8FA' },
  red: { fill: 'linear-gradient(180deg,#F2685B 0%,#E0392C 100%)', chip: '#F4A39B' },
  orange: { fill: 'linear-gradient(180deg,#FBA340 0%,#F47C1A 100%)', chip: '#FCC585' },
  green: { fill: 'linear-gradient(180deg,#2FD9A4 0%,#15BC85 100%)', chip: '#88EAC9' },
  purple: { fill: 'linear-gradient(180deg,#A98BF0 0%,#8453E6 100%)', chip: '#CBB6F6' },
  pink: { fill: 'linear-gradient(180deg,#FF9FC4 0%,#F76FA3 100%)', chip: '#FFC4DA' },
} as const;

/** Answer-option colours, top→bottom, exactly as the reference (blue·red·orange·green…). */
export const OPTION_ORDER = ['blue', 'red', 'orange', 'green', 'purple', 'pink'] as const;
export const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

// ───────────────────────────── Page shell ──────────────────────────────────

/** Full-bleed desert page: sky/sand plate + black top bar + content area. */
export function GameShell({
  children,
  variant = 'sky',
  className = '',
}: {
  children: ReactNode;
  /** 'sky' = blue plate (default), 'sand' = warm orange plate (team standings). */
  variant?: 'sky' | 'sand';
  className?: string;
}) {
  const bg = variant === 'sand' ? '/art/host-bg-team.jpg' : '/art/host-bg-sky.jpg';
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-desert-night">
      <img
        src={bg}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
      />
      <TopBar />
      <main className={`relative z-10 flex flex-1 flex-col ${className}`}>{children}</main>
    </div>
  );
}

/** Black brand bar — title on the right (RTL start), sign-in on the left. */
export function TopBar() {
  return (
    <header className="relative z-20 shrink-0 bg-desert-night">
      <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-5 py-3 lg:px-8">
        <span className="font-display text-base font-extrabold tracking-wide lg:text-lg" style={{ color: GOLD }}>
          البقاء للأقوى
        </span>
        <span className="font-display text-sm font-bold lg:text-base" style={{ color: GOLD }}>
          تسجيل الدخول
        </span>
      </div>
    </header>
  );
}

/** Centres a card in the remaining space (the common phone layout). */
export function CenterStage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-1 items-center justify-center px-5 py-6 ${className}`}>{children}</div>
  );
}

// ───────────────────────────── Yellow card ─────────────────────────────────

export function YellowCard({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 230, damping: 24 }}
      className={`relative w-full max-w-[460px] overflow-hidden rounded-[2rem] px-7 py-8 shadow-[0_38px_80px_-34px_rgba(150,90,0,0.85)] ring-1 ring-white/45 ${className}`}
      style={{ backgroundImage: CARD_BG, ...style }}
    >
      <WaveTexture />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

/** Subtle flowing wave streaks baked into the yellow card (ref texture). */
function WaveTexture() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 400"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-60"
    >
      <path d="M-40 120 C 90 70 150 175 260 130 S 430 120 460 150 L 460 -40 L -40 -40 Z" fill="rgba(255,255,255,0.16)" />
      <path d="M-40 250 C 110 200 170 300 300 250 S 430 250 460 280 L 460 200 C 430 175 300 220 200 255 S 70 215 -40 235 Z" fill="rgba(255,200,28,0.18)" />
      <path d="M-40 360 C 120 320 200 400 340 350 L 460 360 L 460 440 L -40 440 Z" fill="rgba(255,255,255,0.12)" />
    </svg>
  );
}

// ───────────────────────────── Squircle tile ───────────────────────────────

/** Glossy orange icon tile (player avatar frame, timer, countdown). */
export function Squircle({
  size = 84,
  children,
  bg = TILE_BG,
  className = '',
}: {
  size?: number;
  children: ReactNode;
  bg?: string;
  className?: string;
}) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-[26%] text-white shadow-[0_14px_28px_-10px_rgba(210,90,10,0.7),inset_0_2px_2px_rgba(255,255,255,0.45)] ${className}`}
      style={{ width: size, height: size, backgroundImage: bg }}
    >
      {children}
    </span>
  );
}

// ───────────────────────────── Badges / pills ──────────────────────────────

type PillColor = keyof typeof PILLS;

/** Glossy status pill (round badge, category, "waiting" CTA). */
export function Pill({
  children,
  color = 'orange',
  fill,
  className = '',
}: {
  children: ReactNode;
  color?: PillColor;
  /** Explicit gradient/colour override (e.g. a category's own colour). */
  fill?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-5 py-1.5 font-display text-sm font-extrabold text-white shadow-[0_10px_22px_-10px_rgba(0,0,0,0.55),inset_0_1.5px_1px_rgba(255,255,255,0.4)] ${className}`}
      style={fill ? { background: fill } : { backgroundImage: PILLS[color].fill }}
    >
      {children}
    </span>
  );
}

// ───────────────────────────── Headings ────────────────────────────────────

/** Gold gradient hero heading (champion / final ranking). */
export function GoldHeading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h1
      className={`bg-clip-text text-center font-display font-black text-transparent ${className}`}
      style={{
        backgroundImage: 'linear-gradient(180deg,#FFE9A8 0%,#F6C43E 55%,#E89A18 100%)',
        filter: 'drop-shadow(0 6px 22px rgba(244,180,40,0.45))',
        lineHeight: 1.25,
        paddingBlockEnd: '0.12em',
      }}
    >
      {children}
    </h1>
  );
}

// ───────────────────────────── Answer pill ─────────────────────────────────

export function AnswerPill({
  index,
  text,
  picked = false,
  dimmed = false,
  disabled = false,
  onClick,
}: {
  index: number;
  text: string;
  picked?: boolean;
  dimmed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const c = PILLS[OPTION_ORDER[index % OPTION_ORDER.length] ?? 'blue'];
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      animate={{ opacity: dimmed ? 0.4 : 1, scale: picked ? 1.03 : 1 }}
      className={`flex w-full items-center gap-3 rounded-full p-2 ps-3 text-white shadow-[0_14px_26px_-12px_rgba(0,0,0,0.45),inset_0_2px_1px_rgba(255,255,255,0.35)] ${
        picked ? 'ring-4 ring-white' : ''
      }`}
      style={{ background: c.fill }}
    >
      <span className="flex-1 truncate text-center font-display text-xl font-extrabold drop-shadow-sm" dir="auto">
        {text}
      </span>
      <span
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-2xl font-black text-white shadow-[inset_0_2px_3px_rgba(255,255,255,0.5)]"
        style={{ background: c.chip }}
      >
        {LETTERS[index]}
      </span>
    </motion.button>
  );
}

// ───────────────────────────── Leaderboard row ─────────────────────────────

/** Candy leaderboard pill — rank · name · avatar · value (ref 18 / 24). */
export function LeaderRow({
  rank,
  name,
  color,
  avatar,
  value,
  dimmed = false,
  highlight = false,
}: {
  rank: number;
  name: string;
  /** Base colour (player avatar / team colour) → drives the pill fill. */
  color: string;
  avatar?: ReactNode;
  value?: ReactNode;
  dimmed?: boolean;
  highlight?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: dimmed ? 0.5 : 1, x: 0 }}
      className={`flex items-center gap-3 rounded-full px-3 py-2.5 text-white shadow-[0_12px_24px_-12px_rgba(0,0,0,0.5),inset_0_2px_1px_rgba(255,255,255,0.3)] ${
        highlight ? 'ring-4 ring-white/80' : ''
      }`}
      style={{ background: `linear-gradient(180deg, ${tint(color, 0.22)} 0%, ${color} 100%)` }}
    >
      <span className="tnum w-7 shrink-0 text-center font-display text-lg font-black">{rank}</span>
      <span className="min-w-0 flex-1 truncate text-start font-display text-lg font-extrabold" dir="auto">
        {name}
      </span>
      {avatar}
      {value != null && (
        <span className="tnum grid h-9 min-w-9 shrink-0 place-items-center rounded-full bg-white/30 px-2 font-display text-base font-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]">
          {value}
        </span>
      )}
    </motion.div>
  );
}

/** Base colour of a player's avatar — used to colour their leaderboard pill. */
export function avatarColor(avatarId: string | undefined): string {
  return (avatarId && getAvatar(avatarId)?.gradient[0]) || '#5BA8F5';
}

/** Lighten a hex colour toward white by `amt` (0..1). */
function tint(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}
