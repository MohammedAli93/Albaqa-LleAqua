import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Users, Coins, Swords, ChevronLeft, type LucideIcon } from 'lucide-react';
import { GameType, GameMode } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../../store.js';
import { SCREEN_URL } from '../../lib/config.js';
import { CategoryPicker } from '../../components/CategoryPicker.js';

/**
 * Game creation launcher (the phone tells the big screen what to host).
 *   Step 'type'     — choose TYPE (Individual / Teams), big one-tap cards.
 *   Step 'mode'     — (individual only) choose MODE (Points / Elimination).
 *                     Teams skips this (team mode is always points).
 *   Step 'category' — choose the question category, then launch.
 * Falls back to join-by-code when no big screen is configured.
 */
type ModeDef = { key: GameMode; icon: LucideIcon; title: string; desc: string; tint: string };
type Step = 'type' | 'mode' | 'category';

export function Play() {
  const { locale, set } = useStore();
  const [step, setStep] = useState<Step>('type');
  const [pendingType, setPendingType] = useState<GameType>(GameType.INDIVIDUAL);
  const [pendingMode, setPendingMode] = useState<GameMode>(GameMode.POINTS);

  const modes: ModeDef[] = [
    { key: GameMode.POINTS, icon: Coins, title: t(locale, 'pointsGame'), desc: t(locale, 'pointsGameDesc'), tint: 'from-brand-deep/15 text-brand-deep' },
    { key: GameMode.ELIMINATION, icon: Swords, title: t(locale, 'eliminationGame'), desc: t(locale, 'eliminationGameDesc'), tint: 'from-action/15 text-action' },
  ];

  /** Open the chosen game on the big screen (or fall back to join-by-code). */
  function launch(opts: { categoryId?: string; perPlayer?: boolean }) {
    const params = new URLSearchParams({ type: pendingType, mode: pendingMode });
    if (opts.categoryId) params.set('cat', opts.categoryId);
    if (opts.perPlayer) params.set('pp', '1');
    if (SCREEN_URL) {
      window.open(`${SCREEN_URL}/?${params.toString()}`, '_blank');
      set({ appView: 'home' });
    } else {
      set({ appView: 'game', phase: 'join' });
    }
  }

  function chooseType(type: GameType) {
    setPendingType(type);
    if (type === GameType.TEAMS) {
      setPendingMode(GameMode.POINTS);
      setStep('category');
    } else {
      setStep('mode');
    }
  }

  function goBack() {
    if (step === 'category') setStep(pendingType === GameType.TEAMS ? 'type' : 'mode');
    else if (step === 'mode') setStep('type');
    else set({ appView: 'home' });
  }

  const heading =
    step === 'type' ? t(locale, 'chooseGameType') : step === 'mode' ? t(locale, 'chooseGameMode') : t(locale, 'chooseCategory');

  return (
    <div className="flex min-h-dvh flex-col px-5 py-6">
      {/* Back (left) + game-name logo (center) */}
      <div className="flex items-center justify-between">
        <button onClick={goBack} className="flex items-center gap-1 text-ink-secondary">
          <ChevronLeft size={20} /> {t(locale, 'back')}
        </button>
        <span className="font-display text-2xl font-black text-gradient">{t(locale, 'appName')}</span>
        <span className="w-12" aria-hidden />
      </div>

      <h1 className="mt-4 font-display text-3xl font-black">{heading}</h1>
      {step === 'category' && (
        <p className="mt-1 text-sm text-ink-secondary">{t(locale, 'chooseCategoryHint')}</p>
      )}

      {step === 'type' && (
        // ── Step: type — simple stacked cards (icon → title → tagline) ──
        <div className="mt-6 grid grid-cols-1 gap-4">
          <TypeCard
            icon={User}
            title={t(locale, 'individual')}
            tagline={t(locale, 'individualTagline')}
            grad="from-brand-violet to-brand-deep"
            delay={0}
            onClick={() => chooseType(GameType.INDIVIDUAL)}
          />
          <TypeCard
            icon={Users}
            title={t(locale, 'teams')}
            tagline={t(locale, 'teamsTagline')}
            grad="from-action-hot to-action"
            delay={0.06}
            onClick={() => chooseType(GameType.TEAMS)}
          />
        </div>
      )}

      {step === 'mode' && (
        // ── Step: individual mode pick ──
        <div className="mt-6 space-y-3">
          {modes.map((m, i) => {
            const Icon = m.icon;
            return (
              <motion.button
                key={m.key}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setPendingMode(m.key); setStep('category'); }}
                className={`glass flex w-full items-center gap-4 rounded-xl3 bg-gradient-to-l ${m.tint} to-white p-5 text-start`}
              >
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white shadow-glass">
                  <Icon size={26} />
                </span>
                <span className="flex-1">
                  <span className="block font-display text-xl font-extrabold text-ink-primary">{m.title}</span>
                  <span className="block text-sm text-ink-secondary">{m.desc}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
      )}

      {step === 'category' && (
        <div className="mt-5">
          {/* Each player picks their own category (turn-based) */}
          <button
            onClick={() => launch({ perPlayer: true })}
            className="flex w-full items-center gap-3 rounded-xl3 bg-gradient-brand p-5 text-start text-white shadow-glow transition active:scale-[0.98]"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <Users size={26} />
            </span>
            <span className="flex-1">
              <span className="block font-display text-xl font-extrabold">{t(locale, 'eachPlayerCategory')}</span>
              <span className="block text-sm text-white/85">{t(locale, 'eachPlayerCategoryHint')}</span>
            </span>
          </button>

          <div className="my-5 flex items-center gap-3 text-sm text-ink-muted">
            <span className="h-px flex-1 bg-ink-muted/20" />
            {t(locale, 'orPickOneForAll')}
            <span className="h-px flex-1 bg-ink-muted/20" />
          </div>

          <CategoryPicker onPick={(categoryId) => launch({ categoryId })} />
        </div>
      )}

      {step !== 'category' && (
        <p className="mt-auto pt-8 text-center text-sm leading-relaxed text-ink-muted">
          افتح اللعبة على الشاشة الكبيرة، وامسح الكود من جوّالك.
        </p>
      )}
    </div>
  );
}

function TypeCard({
  icon: Icon, title, tagline, grad, delay, onClick,
}: {
  icon: LucideIcon; title: string; tagline: string;
  grad: string; delay: number; onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 220, damping: 22 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="glass flex flex-col items-center gap-3 rounded-xl3 p-5 text-center shadow-card transition active:shadow-glow"
    >
      <span className={`grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br ${grad} text-white shadow-glow`}>
        <Icon className="h-8 w-8" strokeWidth={2.2} />
      </span>
      <span className="font-display text-2xl font-black text-ink-primary">{title}</span>
      <span className="font-display text-sm font-bold leading-snug text-ink-secondary">{tagline}</span>
    </motion.button>
  );
}
