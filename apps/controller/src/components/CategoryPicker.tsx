import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { fetchCategoryGroups, type PickerGroup, type PickerCategory } from '../lib/categories.js';
import { CategoryArt } from './CategoryArt.js';
import { CategoryImage } from './CategoryImage.js';
import { Spinner } from './Spinner.js';

/**
 * Guided two-step category picker. Step 1: pick a main group. Step 2: pick a
 * sub-category within it (a clear "button after button" flow). Categories already
 * claimed by other players are hidden so each player ends up with a unique one.
 */
export function CategoryPicker({
  onPick,
  claimedIds,
}: {
  onPick: (categoryId: string) => void;
  /** Category ids taken by OTHER players — hidden from this picker. */
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

  // Available = not claimed by someone else. Empty groups are dropped.
  const taken = claimedIds ?? new Set<string>();
  const avail = (cats: PickerCategory[]) => cats.filter((c) => !taken.has(c.id));
  const liveGroups = groups
    .map((g) => ({ ...g, categories: avail(g.categories) }))
    .filter((g) => g.categories.length > 0);

  // No categories configured / all taken — never dead-end: offer a mixed start.
  if (liveGroups.length === 0) {
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
          <div className="grid grid-cols-2 gap-2.5">
            {cats.map((c, i) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onPick(c.id)}
                className="group relative flex aspect-[5/4] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl px-3 py-3 text-center font-display text-base font-bold text-white shadow-card"
                style={{ backgroundImage: `linear-gradient(140deg, ${c.color} 0%, ${shade(c.color)} 100%)` }}
              >
                <CategoryImage slug={c.slug} alt={c.nameAr} />
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <span className="pointer-events-none absolute -bottom-5 -left-4 h-16 w-16 rounded-full bg-white/15 blur-xl" />
                <CategoryArt slug={c.slug} className="relative h-10 w-10 drop-shadow" />
                <span className="relative block leading-snug drop-shadow-sm">{c.nameAr}</span>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Step 1: main groups ──
  return (
    <div className="mt-4 space-y-2.5 pb-8">
      {liveGroups.map((group, gi) => (
        <motion.button
          key={group.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(gi * 0.04, 0.3) }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setOpenGroup(group)}
          className="flex w-full items-center gap-4 overflow-hidden rounded-2xl p-4 text-start text-white shadow-card"
          style={{ backgroundImage: `linear-gradient(140deg, ${group.color} 0%, ${shade(group.color)} 100%)` }}
        >
          <CategoryArt slug={group.slug} className="h-10 w-10 shrink-0 drop-shadow" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-lg font-black drop-shadow-sm">{group.nameAr}</span>
            <span className="block text-sm font-semibold text-white/80">
              {t(locale, 'categoryCount', { count: group.categories.length })}
            </span>
          </span>
          <ChevronRight size={22} className="shrink-0 opacity-90" />
        </motion.button>
      ))}
    </div>
  );
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
