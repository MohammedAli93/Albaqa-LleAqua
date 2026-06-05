import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Users, Coins, Swords, ChevronLeft, Minus, Plus, type LucideIcon } from 'lucide-react';
import { GameType, GameMode, GAME_LIMITS, DEFAULT_TEAM_COUNT, DEFAULT_PLAYERS_PER_TEAM } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../../store.js';
import { SCREEN_URL } from '../../lib/config.js';

/**
 * Mandatory two-step game creation:
 *   Step 1 — choose game TYPE (Individual / Teams)
 *   Step 2 — choose gameplay MODE (Points / Elimination); Teams also configure
 *            the number of teams and players per team.
 * On confirm we launch a configured game on the big screen (host), or fall back
 * to join-by-code when no screen URL is configured.
 */
type TypeDef = { key: GameType; icon: LucideIcon; title: string; desc: string };
type ModeDef = { key: GameMode; icon: LucideIcon; title: string; desc: string; tint: string };

export function Play() {
  const { locale, set } = useStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<GameType | null>(null);
  const [teamCount, setTeamCount] = useState(DEFAULT_TEAM_COUNT);
  const [playersPerTeam, setPlayersPerTeam] = useState(DEFAULT_PLAYERS_PER_TEAM);

  const types: TypeDef[] = [
    { key: GameType.INDIVIDUAL, icon: User, title: t(locale, 'individual'), desc: t(locale, 'individualDesc') },
    { key: GameType.TEAMS, icon: Users, title: t(locale, 'teams'), desc: t(locale, 'teamsDesc') },
  ];
  const modes: ModeDef[] = [
    { key: GameMode.POINTS, icon: Coins, title: t(locale, 'pointsGame'), desc: t(locale, 'pointsGameDesc'), tint: 'from-brand-deep/15 text-brand-deep' },
    { key: GameMode.ELIMINATION, icon: Swords, title: t(locale, 'eliminationGame'), desc: t(locale, 'eliminationGameDesc'), tint: 'from-action/15 text-action' },
  ];

  function chooseMode(mode: GameMode) {
    const params = new URLSearchParams({ type: type!, mode });
    if (type === GameType.TEAMS) {
      params.set('teams', String(teamCount));
      params.set('perTeam', String(playersPerTeam));
    }
    if (SCREEN_URL) {
      window.open(`${SCREEN_URL}/?${params.toString()}`, '_blank');
      set({ appView: 'home' });
    } else {
      // No big screen configured — fall back to joining a hosted game by code.
      set({ appView: 'game', phase: 'join' });
    }
  }

  return (
    <div className="flex min-h-screen flex-col px-5 py-6">
      <button
        onClick={() => (step === 2 ? setStep(1) : set({ appView: 'home' }))}
        className="flex items-center gap-1 self-start text-ink-secondary"
      >
        <ChevronLeft size={20} /> {t(locale, 'back')}
      </button>

      {/* Step indicator */}
      <div className="mt-4 flex items-center gap-2">
        <Dot active={step >= 1} />
        <div className="h-0.5 w-8 rounded bg-ink-muted/30" />
        <Dot active={step >= 2} />
      </div>

      <h1 className="mt-3 font-display text-3xl font-black">
        {step === 1 ? t(locale, 'chooseGameType') : t(locale, 'chooseGameMode')}
      </h1>

      {step === 1 ? (
        <div className="mt-6 space-y-3">
          {types.map((ty, i) => {
            const Icon = ty.icon;
            return (
              <motion.button
                key={ty.key}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setType(ty.key); setStep(2); }}
                className="glass flex w-full items-center gap-4 rounded-xl3 p-5 text-start"
              >
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-white">
                  <Icon size={26} />
                </span>
                <span className="flex-1">
                  <span className="block font-display text-xl font-extrabold text-ink-primary">{ty.title}</span>
                  <span className="block text-sm text-ink-secondary">{ty.desc}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {type === GameType.TEAMS && (
            <div className="glass rounded-xl3 p-5">
              <Stepper
                label={t(locale, 'teamCount')}
                value={teamCount}
                min={GAME_LIMITS.MIN_TEAMS}
                max={GAME_LIMITS.MAX_TEAMS}
                onChange={setTeamCount}
              />
              <div className="my-4 h-px bg-ink-muted/15" />
              <Stepper
                label={t(locale, 'playersPerTeam')}
                value={playersPerTeam}
                min={GAME_LIMITS.MIN_PLAYERS_PER_TEAM}
                max={GAME_LIMITS.MAX_PLAYERS_PER_TEAM}
                onChange={setPlayersPerTeam}
              />
              <p className="mt-3 text-center text-sm text-ink-muted">{t(locale, 'teamVsTeam')}</p>
            </div>
          )}
          {modes.map((m, i) => {
            const Icon = m.icon;
            return (
              <motion.button
                key={m.key}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }}
                whileTap={{ scale: 0.97 }}
                onClick={() => chooseMode(m.key)}
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

      <p className="mt-7 text-center text-sm leading-relaxed text-ink-muted">
        للّعب الجماعي افتح الشاشة الكبيرة وامسح الكود — أو انضمّ بكود من صديقك.
      </p>
    </div>
  );
}

function Dot({ active }: { active: boolean }) {
  return <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-brand-deep' : 'bg-ink-muted/30'}`} />;
}

function Stepper({
  label, value, min, max, onChange,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-display text-lg font-bold">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="grid h-10 w-10 place-items-center rounded-xl2 bg-bg-sunken text-ink-primary disabled:opacity-30"
        >
          <Minus size={18} />
        </button>
        <span className="w-8 text-center font-display text-2xl font-bold tnum">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="grid h-10 w-10 place-items-center rounded-xl2 bg-bg-sunken text-ink-primary disabled:opacity-30"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
