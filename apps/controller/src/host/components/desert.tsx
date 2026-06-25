import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { getAvatar } from '@tahaddi/shared';

/*
 * Big-screen (TV / desktop host) desert kit — the candy leaderboard pills, gold
 * headings and round badge from the client reference set (Assets/References 20 &
 * 24), scaled up for the projector. Pairs with HostBg for the sky/sand plate.
 */

/** Round badge — blue pill (reference screens 20 / 21). */
export function RoundPill({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full px-6 py-2 font-display text-screen-meta font-black text-white shadow-[0_12px_26px_-12px_rgba(0,0,0,0.55),inset_0_2px_1px_rgba(255,255,255,0.4)]"
      style={{ backgroundImage: 'linear-gradient(180deg,#5BA8F5 0%,#3C84E8 100%)' }}
    >
      {children}
    </span>
  );
}

/** Gold gradient hero heading + floating trophy (reference screen 24). */
export function GoldTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h1
      className={`w-full bg-clip-text text-center font-display font-black text-transparent ${className}`}
      style={{
        backgroundImage: 'linear-gradient(180deg,#FFE9A8 0%,#F6C43E 55%,#E89A18 100%)',
        filter: 'drop-shadow(0 6px 26px rgba(244,180,40,0.45))',
        lineHeight: 1.22,
        paddingBlockEnd: '0.1em',
      }}
    >
      {children}
    </h1>
  );
}

/** Candy leaderboard pill — rank · avatar · name · value (reference screen 24). */
export function LeaderRow({
  rank,
  name,
  color,
  avatar,
  value,
  badge,
  dimmed = false,
  highlight = false,
}: {
  rank: ReactNode;
  name: string;
  color: string;
  avatar?: ReactNode;
  value?: ReactNode;
  badge?: ReactNode;
  dimmed?: boolean;
  highlight?: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: dimmed ? 0.5 : 1, x: 0, filter: dimmed ? 'grayscale(0.6)' : 'none' }}
      transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-white shadow-[0_16px_30px_-14px_rgba(0,0,0,0.5),inset_0_2px_1px_rgba(255,255,255,0.3)] lg:gap-5 lg:px-6 lg:py-3.5 ${
        highlight ? 'ring-4 ring-[#FFE9A8]' : ''
      }`}
      style={{ background: `linear-gradient(180deg, ${tint(color, 0.24)} 0%, ${color} 100%)` }}
    >
      <span className="tnum w-9 shrink-0 text-center font-display text-screen-ranknum font-black lg:w-12">{rank}</span>
      {avatar}
      <span className="min-w-0 flex-1 truncate text-start font-display text-screen-rankname font-black" dir="auto">
        {name}
      </span>
      {badge}
      {value != null && (
        <span className="tnum grid h-11 min-w-11 shrink-0 place-items-center rounded-full bg-white/30 px-3 font-display text-screen-rankname font-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] lg:h-14 lg:min-w-14">
          {value}
        </span>
      )}
    </motion.div>
  );
}

/** Base colour of a player's avatar — drives their pill fill. */
export function avatarColor(avatarId: string | undefined): string {
  return (avatarId && getAvatar(avatarId)?.gradient[0]) || '#5BA8F5';
}

/** Lighten a hex colour toward white by `amt` (0..1). */
export function tint(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}
