import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Users, Coins, Swords, ChevronLeft, type LucideIcon } from 'lucide-react';
import { GameType, GameMode } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../../store.js';
import { SCREEN_URL } from '../../lib/config.js';

/**
 * Game creation launcher (the phone tells the big screen what to host).
 *   Step 'type'     — choose TYPE (Individual / Teams), big one-tap cards.
 *   Step 'mode'     — (individual only) choose MODE (Points / Elimination).
 *                     Teams skips this (team mode is always points).
 *   Step 'category' — choose the question category, then launch.
 * Falls back to join-by-code when no big screen is configured.
 */
type ModeDef = { key: GameMode; icon: LucideIcon; title: string; desc: string; tint: string };
type Step = 'type' | 'mode';

export function Play() {
  const { locale, set } = useStore();
  const [step, setStep] = useState<Step>('type');

  const modes: ModeDef[] = [
    { key: GameMode.POINTS, icon: Coins, title: t(locale, 'pointsGame'), desc: t(locale, 'pointsGameDesc'), tint: 'from-brand-deep/15 text-brand-deep' },
    { key: GameMode.ELIMINATION, icon: Swords, title: t(locale, 'eliminationGame'), desc: t(locale, 'eliminationGameDesc'), tint: 'from-action/15 text-action' },
  ];

  /**
   * Launch the game on the big screen. Every game is per-player-category: each
   * player picks their own category (football/history/…) in the lobby BEFORE the
   * host starts — the category step lives in the lobby, not here.
   */
  function launch(type: GameType, mode: GameMode) {
    const params = new URLSearchParams({ type, mode, pp: '1' });
    if (SCREEN_URL) {
      window.open(`${SCREEN_URL}/?${params.toString()}`, '_blank');
      set({ appView: 'home' });
    } else {
      set({ appView: 'game', phase: 'join' });
    }
  }

  function chooseType(type: GameType) {
    if (type === GameType.TEAMS) launch(GameType.TEAMS, GameMode.POINTS);
    else setStep('mode');
  }

  function goBack() {
    if (step === 'mode') setStep('type');
    else set({ appView: 'home' });
  }

  const heading = step === 'type' ? t(locale, 'chooseGameType') : t(locale, 'chooseGameMode');

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
                onClick={() => launch(GameType.INDIVIDUAL, m.key)}
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

      <p className="mt-auto pt-8 text-center text-sm leading-relaxed text-ink-muted">
        افتح اللعبة على الشاشة الكبيرة، ثم كل لاعب يمسح الكود ويختار فئته.
      </p>
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
