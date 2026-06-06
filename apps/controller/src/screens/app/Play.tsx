import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Users, Coins, Swords, ChevronLeft, type LucideIcon } from 'lucide-react';
import { GameType, GameMode } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../../store.js';
import { SCREEN_URL } from '../../lib/config.js';

/**
 * Game creation launcher (the phone tells the big screen what to host).
 *   Step 1 — choose TYPE (Individual / Teams), big one-tap cards.
 *   Individual → Step 2: choose MODE (Points / Elimination), then launch.
 *   Teams → launch straight away as a points game; the host names the teams on
 *           the big screen (team mode is always points — no elimination).
 * Falls back to join-by-code when no big screen is configured.
 */
type ModeDef = { key: GameMode; icon: LucideIcon; title: string; desc: string; tint: string };

export function Play() {
  const { locale, set } = useStore();
  const [step, setStep] = useState<1 | 2>(1);

  const modes: ModeDef[] = [
    { key: GameMode.POINTS, icon: Coins, title: t(locale, 'pointsGame'), desc: t(locale, 'pointsGameDesc'), tint: 'from-brand-deep/15 text-brand-deep' },
    { key: GameMode.ELIMINATION, icon: Swords, title: t(locale, 'eliminationGame'), desc: t(locale, 'eliminationGameDesc'), tint: 'from-action/15 text-action' },
  ];

  /** Open the chosen game on the big screen (or fall back to join-by-code). */
  function launch(type: GameType, mode: GameMode) {
    const params = new URLSearchParams({ type, mode });
    if (SCREEN_URL) {
      window.open(`${SCREEN_URL}/?${params.toString()}`, '_blank');
      set({ appView: 'home' });
    } else {
      set({ appView: 'game', phase: 'join' });
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 py-6">
      <button
        onClick={() => (step === 2 ? setStep(1) : set({ appView: 'home' }))}
        className="flex items-center gap-1 self-start text-ink-secondary"
      >
        <ChevronLeft size={20} /> {t(locale, 'back')}
      </button>

      <h1 className="mt-4 font-display text-3xl font-black">
        {step === 1 ? t(locale, 'chooseGameType') : t(locale, 'chooseGameMode')}
      </h1>

      {step === 1 ? (
        // ── Step 1: type — two big, clear cards ──
        <div className="mt-6 grid grid-cols-1 gap-4">
          <TypeCard
            icon={User}
            title={t(locale, 'individual')}
            tagline={t(locale, 'individualTagline')}
            grad="from-brand-violet to-brand-deep"
            delay={0}
            onClick={() => setStep(2)}
          />
          <TypeCard
            icon={Users}
            title={t(locale, 'teams')}
            tagline={t(locale, 'teamsTagline')}
            grad="from-action-hot to-action"
            delay={0.06}
            onClick={() => launch(GameType.TEAMS, GameMode.POINTS)}
          />
        </div>
      ) : (
        // ── Step 2 (individual only): pick the mode ──
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
        افتح اللعبة على الشاشة الكبيرة، وامسح الكود من جوّالك.
      </p>
    </div>
  );
}

function TypeCard({
  icon: Icon, title, tagline, grad, delay, onClick,
}: { icon: LucideIcon; title: string; tagline: string; grad: string; delay: number; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="glass flex flex-col items-center gap-3 rounded-xl3 p-7 text-center"
    >
      <span className={`grid h-20 w-20 place-items-center rounded-[1.75rem] bg-gradient-to-br ${grad} text-white shadow-glow`}>
        <Icon className="h-10 w-10" strokeWidth={2.2} />
      </span>
      <span className="font-display text-3xl font-black text-ink-primary">{title}</span>
      <span className="font-display text-lg font-bold text-ink-secondary">{tagline}</span>
    </motion.button>
  );
}
