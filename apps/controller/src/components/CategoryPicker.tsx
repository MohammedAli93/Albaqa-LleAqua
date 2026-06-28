import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Lock, Check } from 'lucide-react';
import { t, type Locale } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { fetchCategoryGroups, type PickerGroup, type PickerCategory } from '../lib/categories.js';
import { categoryEmoji } from './CategoryArt.js';
import { GOLD } from './desert.js';
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
    return <p className="mt-10 text-center font-semibold text-ink-primary">{t(locale, 'error')}</p>;
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

  // ── Step 2: sub-categories of the chosen group — an iOS-style scroll wheel ──
  if (openGroup) {
    const live = liveGroups.find((g) => g.id === openGroup.id);
    const cats = live?.categories ?? [];
    return (
      <div className="mt-4 pb-8">
        <button
          onClick={() => setOpenGroup(null)}
          className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 font-display text-sm font-bold text-white"
        >
          <ChevronLeft size={18} />
          {t(locale, 'back')}
        </button>
        <div className="mb-3 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: openGroup.color }} />
          <h2 className="font-display text-xl font-black text-white">{openGroup.nameAr}</h2>
        </div>
        {cats.length === 0 ? (
          <p className="mt-8 text-center font-semibold text-white">{t(locale, 'allCategoriesTaken')}</p>
        ) : (
          <CategoryWheel cats={cats} taken={taken} onPick={onPick} locale={locale} />
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
        {sub && <span className="block text-[0.65rem] font-bold text-ink-secondary">{sub}</span>}
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
function EmojiSticker({
  emoji,
  imgClass = 'h-12 w-12 sm:h-16 sm:w-16',
  txtClass = 'text-[2.6rem] leading-none sm:text-5xl',
}: {
  emoji: string;
  imgClass?: string;
  txtClass?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={txtClass}>{emoji}</span>;
  return (
    <img
      src={twemojiUrl(emoji)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={imgClass}
    />
  );
}

/**
 * iOS-style scroll wheel for picking a sub-category (e.g. the 18 Arab countries).
 * Names scroll vertically; the centered row sits in a gold band and is the active
 * selection. A confirm button commits it. Categories already claimed by other
 * players show greyed + locked and can't be confirmed.
 */
function CategoryWheel({
  cats,
  taken,
  onPick,
  locale,
}: {
  cats: PickerCategory[];
  taken: Set<string>;
  onPick: (id: string) => void;
  locale: Locale;
}) {
  const ITEM_H = 64;
  const VISIBLE = 5;
  const PAD = ((VISIBLE - 1) / 2) * ITEM_H;
  const scroller = useRef<HTMLDivElement>(null);
  const raf = useRef<number | undefined>(undefined);
  const [selected, setSelected] = useState(() => {
    const i = cats.findIndex((c) => !taken.has(c.id));
    return i < 0 ? 0 : i;
  });

  // Land on the first selectable row when the wheel mounts.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = selected * ITEM_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const idx = Math.max(0, Math.min(cats.length - 1, Math.round(el.scrollTop / ITEM_H)));
      setSelected((prev) => (prev === idx ? prev : idx));
    });
  }

  const current = cats[selected];
  const blocked = !current || taken.has(current.id);

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="relative">
        {/* gold selection band over the centered row */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 px-1"
          style={{ height: ITEM_H }}
        >
          <div className="h-full rounded-2xl border-2 bg-white/10" style={{ borderColor: GOLD }} />
        </div>
        {/* top / bottom fades into the night plate */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/3 bg-gradient-to-b from-desert-night to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/3 bg-gradient-to-t from-desert-night to-transparent" />

        <div
          ref={scroller}
          onScroll={onScroll}
          className="relative overflow-y-auto [&::-webkit-scrollbar]:hidden"
          style={{ height: VISIBLE * ITEM_H, scrollSnapType: 'y mandatory', scrollbarWidth: 'none' }}
        >
          <div style={{ height: PAD }} />
          {cats.map((c, i) => {
            const dist = Math.abs(i - selected);
            const isTaken = taken.has(c.id);
            const active = i === selected;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => scroller.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })}
                className="flex w-full items-center justify-center"
                style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
              >
                <motion.div
                  animate={{
                    scale: dist === 0 ? 1 : dist === 1 ? 0.88 : 0.76,
                    opacity: isTaken ? 0.35 : dist === 0 ? 1 : dist === 1 ? 0.6 : 0.32,
                  }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className="flex items-center gap-3"
                >
                  <EmojiSticker emoji={categoryEmoji(c.slug)} imgClass="h-9 w-9" txtClass="text-3xl leading-none" />
                  <span className={`font-display text-2xl font-black ${active ? 'text-white' : 'text-white/90'}`} dir="auto">
                    {c.nameAr}
                  </span>
                  {isTaken && <Lock size={16} className="text-white/70" />}
                </motion.div>
              </button>
            );
          })}
          <div style={{ height: PAD }} />
        </div>
      </div>

      <p className="mt-1 text-center font-display text-xs font-bold text-white/60">{t(locale, 'scrollToChoose')}</p>

      <motion.button
        whileTap={blocked ? undefined : { scale: 0.96 }}
        disabled={blocked}
        onClick={() => current && onPick(current.id)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-xl font-black text-white shadow-[0_16px_30px_-14px_rgba(0,0,0,0.55)] disabled:opacity-45"
        style={{ backgroundImage: blocked ? 'linear-gradient(180deg,#9aa0a6,#6b7177)' : 'linear-gradient(180deg,#F2796C 0%,#E8473A 100%)' }}
      >
        <Check size={22} strokeWidth={3} />
        {blocked ? (locale === 'ar' ? 'مأخوذة' : 'Taken') : t(locale, 'confirmChoice')}
      </motion.button>
    </div>
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
