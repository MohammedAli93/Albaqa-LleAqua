import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Users, Coins, Swords, ChevronLeft, Check, type LucideIcon } from 'lucide-react';
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
  function launch(type: GameType, mode: GameMode, categoryId: string) {
    const params = new URLSearchParams({ type, mode });
    if (categoryId) params.set('cat', categoryId);
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
      <button onClick={goBack} className="flex items-center gap-1 self-start text-ink-secondary">
        <ChevronLeft size={20} /> {t(locale, 'back')}
      </button>

      <h1 className="mt-4 font-display text-3xl font-black">{heading}</h1>
      {step === 'category' && (
        <p className="mt-1 text-sm text-ink-secondary">{t(locale, 'chooseCategoryHint')}</p>
      )}

      {step === 'type' && (
        // ── Step: type — two big, premium cards with clear value bullets ──
        <div className="mt-6 grid grid-cols-1 gap-5">
          <TypeCard
            icon={User}
            title={t(locale, 'individual')}
            tagline={t(locale, 'individualTagline')}
            bullets={[t(locale, 'individualPoint1'), t(locale, 'individualPoint2'), t(locale, 'individualPoint3')]}
            grad="from-brand-violet to-brand-deep"
            delay={0}
            onClick={() => chooseType(GameType.INDIVIDUAL)}
          />
          <TypeCard
            icon={Users}
            title={t(locale, 'teams')}
            tagline={t(locale, 'teamsTagline')}
            bullets={[t(locale, 'teamsPoint1'), t(locale, 'teamsPoint2'), t(locale, 'teamsPoint3')]}
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
        <CategoryPicker onPick={(categoryId) => launch(pendingType, pendingMode, categoryId)} />
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
  icon: Icon, title, tagline, bullets, grad, delay, onClick,
}: {
  icon: LucideIcon; title: string; tagline: string; bullets: string[];
  grad: string; delay: number; onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 220, damping: 22 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl4 text-start shadow-card transition active:shadow-glow"
    >
      {/* Gradient header band — the premium game-show face of the card */}
      <div className={`relative flex items-center gap-4 bg-gradient-to-br ${grad} px-6 pb-7 pt-6 text-white`}>
        <span className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
          <Icon className="h-9 w-9" strokeWidth={2.3} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-3xl font-black leading-tight drop-shadow-sm">{title}</span>
          <span className="mt-0.5 block font-display text-lg font-bold text-white/90">{tagline}</span>
        </span>
      </div>

      {/* Body — value bullets, pulled up to overlap the band for depth */}
      <div className="-mt-3 rounded-t-3xl bg-bg-raised px-6 pb-6 pt-5">
        <ul className="space-y-2.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-[15px] leading-snug text-ink-secondary">
              <Check size={18} className="mt-0.5 shrink-0 text-action" strokeWidth={3} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.button>
  );
}
