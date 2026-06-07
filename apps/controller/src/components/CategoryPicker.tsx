import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { fetchCategoryGroups, type PickerGroup } from '../lib/categories.js';
import { Spinner } from './Spinner.js';

/**
 * Grouped category picker — the final step of game creation. Categories are
 * organized under their group; one tap selects and launches. Mobile-first.
 */
export function CategoryPicker({ onPick }: { onPick: (categoryId: string) => void }) {
  const { locale } = useStore();
  const [groups, setGroups] = useState<PickerGroup[] | null>(null);
  const [failed, setFailed] = useState(false);

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

  // No categories configured yet — never dead-end; offer a mixed-questions start.
  const hasAny = groups.some((g) => g.categories.length > 0);
  if (!hasAny) {
    return (
      <button
        onClick={() => onPick('')}
        className="btn-cta mt-8 w-full rounded-2xl py-5 text-2xl font-black"
      >
        {t(locale, 'mixedQuestions')}
      </button>
    );
  }

  return (
    <div className="mt-5 space-y-6 pb-8">
      {groups.map((group, gi) => (
        <motion.section
          key={group.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(gi * 0.04, 0.3) }}
        >
          <div className="mb-2.5 flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: group.color }} />
            <h2 className="font-display text-lg font-extrabold">{group.nameAr}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {group.categories.map((c) => (
              <motion.button
                key={c.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => onPick(c.id)}
                className="relative overflow-hidden rounded-2xl px-4 py-4 text-start font-display text-base font-bold text-white shadow-card"
                style={{ backgroundImage: `linear-gradient(140deg, ${c.color} 0%, ${shade(c.color)} 100%)` }}
              >
                <span className="pointer-events-none absolute -bottom-5 -left-4 h-16 w-16 rounded-full bg-white/15 blur-xl" />
                <span className="relative block leading-snug drop-shadow-sm">{c.nameAr}</span>
              </motion.button>
            ))}
          </div>
        </motion.section>
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
