import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Lock } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { fetchCategoryGroups, type PickerGroup } from '../lib/categories.js';
import { categoryEmoji } from './CategoryArt.js';
import { Spinner } from './Spinner.js';

/**
 * Guided two-step category picker, styled like the landing's cartoon category
 * tiles: a grid of square stickers (sunburst rays + glossy sheen + big cartoon
 * Twemoji + bold label band). Step 1 = pick a main group, Step 2 = pick a
 * sub-category. Categories claimed by other players render greyed + locked.
 */
export function CategoryPicker({
  onPick,
  claimedIds,
}: {
  onPick: (categoryId: string) => void;
  /** Category ids taken by OTHER players — shown greyed/locked, not pickable. */
  claimedIds?: Set<string>;
}) {
  const { locale } = useStore();
  const [groups, setGroups] = useState<PickerGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openGroup, setOpenGroup] = useState<PickerGroup | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCategoryGroups()
      .then((g) => alive && setGroups(g))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (failed) {
    return <p className="mt-10 text-center text-ink-secondary">{t(locale, 'error')}</p>;
  }
  if (!groups) {
    return (
      <div className="mt-16 grid place-items-center">
        <Spinner size={40} label={t(locale, 'loading')} />
      </div>
    );
  }

  const taken = claimedIds ?? new Set<string>();
  const liveGroups = groups.filter((g) => g.categories.length > 0);
  const anyAvailable = liveGroups.some((g) => g.categories.some((c) => !taken.has(c.id)));

  // Nothing configured / everything already taken — never dead-end: offer mixed.
  if (liveGroups.length === 0 || !anyAvailable) {
    return (
      <button
        onClick={() => onPick('')}
        className="btn-cta mt-8 w-full rounded-2xl py-5 text-2xl font-black"
      >
        {t(locale, 'mixedQuestions')}
      </button>
    );
  }

  // ── Step 2: sub-categories of the chosen group ──
  if (openGroup) {
    const live = liveGroups.find((g) => g.id === openGroup.id);
    const cats = live?.categories ?? [];
    return (
      <div className="mt-4 pb-8">
        <button
          onClick={() => setOpenGroup(null)}
          className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-bg-raised/70 px-4 py-2 font-display text-sm font-bold text-ink-secondary"
        >
          <ChevronLeft size={18} />
          {t(locale, 'back')}
        </button>
        <div className="mb-3 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: openGroup.color }} />
          <h2 className="font-display text-xl font-black">{openGroup.nameAr}</h2>
        </div>
        {cats.length === 0 ? (
          <p className="mt-8 text-center text-ink-secondary">{t(locale, 'allCategoriesTaken')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cats.map((c, i) => (
              <Tile
                key={c.id}
                slug={c.slug}
                label={c.nameAr}
                color={c.color}
                index={i}
                taken={taken.has(c.id)}
                takenLabel={locale === 'ar' ? 'مأخوذة' : 'Taken'}
                onClick={() => onPick(c.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Step 1: main groups ──
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 pb-8 sm:grid-cols-3">
      {liveGroups.map((group, gi) => (
        <Tile
          key={group.id}
          slug={group.slug}
          label={group.nameAr}
          color={group.color}
          index={gi}
          sub={t(locale, 'categoryCount', { count: group.categories.length })}
          onClick={() => setOpenGroup(group)}
        />
      ))}
    </div>
  );
}

/** One cartoon category sticker — sunburst + sheen + big Twemoji + label band. */
function Tile({
  slug, label, color, index, sub, taken, takenLabel, onClick,
}: {
  slug: string;
  label: string;
  color: string;
  index: number;
  sub?: string;
  taken?: boolean;
  takenLabel?: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), type: 'spring', stiffness: 240, damping: 18 }}
      whileTap={taken ? undefined : { scale: 0.95 }}
      onClick={() => { if (!taken) onClick(); }}
      disabled={taken}
      aria-disabled={taken}
      className={`group relative aspect-square overflow-hidden rounded-[1.5rem] shadow-card ring-1 ring-black/5 ${taken ? 'cursor-not-allowed' : ''}`}
      style={{ backgroundImage: `linear-gradient(150deg, ${color} 0%, ${shade(color)} 100%)` }}
    >
      {/* cartoon sunburst rays */}
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{ background: 'repeating-conic-gradient(from 0deg at 50% 40%, #fff 0deg 7deg, transparent 7deg 14deg)' }} />
      {/* glossy top sheen */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
      {/* confetti dots */}
      <span aria-hidden className="pointer-events-none absolute left-3.5 top-3.5 h-2 w-2 rounded-full bg-white/55" />
      <span aria-hidden className="pointer-events-none absolute right-4 top-6 h-1.5 w-1.5 rounded-full bg-white/45" />
      {/* big cartoon sticker */}
      <span
        className="absolute inset-x-0 top-[12%] grid place-items-center transition duration-300 group-active:scale-110 group-active:-rotate-6"
        style={{ filter: 'drop-shadow(0 6px 5px rgba(0,0,0,0.25))' }}
      >
        <EmojiSticker emoji={categoryEmoji(slug)} />
      </span>
      {/* bold label band */}
      <span className="absolute inset-x-2 bottom-2 rounded-2xl bg-white/92 px-1 py-1.5 text-center font-display text-sm font-black leading-tight text-ink-primary shadow-sm sm:text-base">
        {label}
        {sub && <span className="block text-[0.65rem] font-bold text-ink-muted">{sub}</span>}
      </span>
      {taken && (
        <span className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-black/60 text-white">
          <Lock size={22} />
          <span className="text-sm font-bold">{takenLabel}</span>
        </span>
      )}
    </motion.button>
  );
}

/** Twemoji cartoon illustration of an emoji, falling back to the OS emoji. */
function EmojiSticker({ emoji }: { emoji: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="text-[2.6rem] leading-none sm:text-5xl">{emoji}</span>;
  return (
    <img
      src={twemojiUrl(emoji)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-12 w-12 sm:h-16 sm:w-16"
    />
  );
}

/** Build the Twemoji CDN path from an emoji's codepoints (drops FE0F like Twemoji). */
function twemojiUrl(emoji: string): string {
  const cps = [...emoji].map((ch) => ch.codePointAt(0)!);
  const hasZwj = cps.includes(0x200d);
  const code = (hasZwj ? cps : cps.filter((cp) => cp !== 0xfe0f))
    .map((cp) => cp.toString(16))
    .join('-');
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${code}.svg`;
}

/** Darken a hex colour ~18% for a subtle gradient end-stop. */
function shade(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = Math.max(0, ((n >> 16) & 255) - 38);
  const g = Math.max(0, ((n >> 8) & 255) - 38);
  const b = Math.max(0, (n & 255) - 38);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
