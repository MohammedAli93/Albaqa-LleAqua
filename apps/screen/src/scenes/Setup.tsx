import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Users, Coins, Swords, ChevronLeft, Minus, Plus, type LucideIcon } from 'lucide-react';
import { GameType, GameMode, GAME_LIMITS, DEFAULT_TEAM_COUNT, DEFAULT_PLAYERS_PER_TEAM } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';

export interface SetupSelection {
  type: GameType;
  mode: GameMode;
  teamCount?: number;
  playersPerTeam?: number;
}

/**
 * Big-screen game creation — the mandatory two steps:
 *   1) game TYPE (Individual / Teams)
 *   2) gameplay MODE (Points / Elimination); Teams also set team count + size.
 */
export function Setup({ onConfirm }: { onConfirm: (sel: SetupSelection) => void }) {
  const { locale } = useStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<GameType | null>(null);
  const [teamCount, setTeamCount] = useState(DEFAULT_TEAM_COUNT);
  const [playersPerTeam, setPlayersPerTeam] = useState(DEFAULT_PLAYERS_PER_TEAM);

  const types: { key: GameType; icon: LucideIcon; title: string; desc: string }[] = [
    { key: GameType.INDIVIDUAL, icon: User, title: t(locale, 'individual'), desc: t(locale, 'individualDesc') },
    { key: GameType.TEAMS, icon: Users, title: t(locale, 'teams'), desc: t(locale, 'teamsDesc') },
  ];
  const modes: { key: GameMode; icon: LucideIcon; title: string; desc: string; tint: string }[] = [
    { key: GameMode.POINTS, icon: Coins, title: t(locale, 'pointsGame'), desc: t(locale, 'pointsGameDesc'), tint: 'text-brand-deep' },
    { key: GameMode.ELIMINATION, icon: Swords, title: t(locale, 'eliminationGame'), desc: t(locale, 'eliminationGameDesc'), tint: 'text-action' },
  ];

  function confirm(mode: GameMode) {
    onConfirm(
      type === GameType.TEAMS
        ? { type, mode, teamCount, playersPerTeam }
        : { type: type!, mode },
    );
  }

  return (
    <div className="safe grid h-full place-items-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong w-full max-w-4xl rounded-xl4 p-12"
      >
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-display text-5xl font-black text-gradient">
            {step === 1 ? t(locale, 'chooseGameType') : t(locale, 'chooseGameMode')}
          </h1>
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 rounded-2xl bg-bg-sunken px-5 py-3 text-2xl text-ink-secondary"
            >
              <ChevronLeft /> {t(locale, 'back')}
            </button>
          )}
        </div>

        {step === 1 ? (
          <div className="grid grid-cols-2 gap-6">
            {types.map((ty) => {
              const Icon = ty.icon;
              return (
                <button
                  key={ty.key}
                  onClick={() => { setType(ty.key); setStep(2); }}
                  className="glass flex flex-col items-center gap-4 rounded-xl3 p-10 transition hover:-translate-y-1 hover:shadow-glow"
                >
                  <span className="grid h-24 w-24 place-items-center rounded-3xl bg-gradient-brand text-white">
                    <Icon size={48} />
                  </span>
                  <span className="font-display text-3xl font-extrabold">{ty.title}</span>
                  <span className="text-xl text-ink-secondary">{ty.desc}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-6">
            {type === GameType.TEAMS && (
              <div className="glass flex items-center justify-around rounded-xl3 p-6">
                <Stepper label={t(locale, 'teamCount')} value={teamCount} min={GAME_LIMITS.MIN_TEAMS} max={GAME_LIMITS.MAX_TEAMS} onChange={setTeamCount} />
                <div className="h-16 w-px bg-ink-muted/15" />
                <Stepper label={t(locale, 'playersPerTeam')} value={playersPerTeam} min={GAME_LIMITS.MIN_PLAYERS_PER_TEAM} max={GAME_LIMITS.MAX_PLAYERS_PER_TEAM} onChange={setPlayersPerTeam} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-6">
              {modes.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.key}
                    onClick={() => confirm(m.key)}
                    className="glass flex flex-col items-center gap-4 rounded-xl3 p-10 transition hover:-translate-y-1 hover:shadow-glow"
                  >
                    <span className="grid h-24 w-24 place-items-center rounded-3xl bg-white shadow-glass">
                      <Icon size={48} className={m.tint} />
                    </span>
                    <span className="font-display text-3xl font-extrabold">{m.title}</span>
                    <span className="text-center text-xl text-ink-secondary">{m.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Stepper({
  label, value, min, max, onChange,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="font-display text-2xl font-bold">{label}</span>
      <div className="flex items-center gap-4">
        <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="grid h-14 w-14 place-items-center rounded-2xl bg-bg-sunken disabled:opacity-30">
          <Minus />
        </button>
        <span className="w-14 text-center font-display text-5xl font-bold tnum">{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="grid h-14 w-14 place-items-center rounded-2xl bg-bg-sunken disabled:opacity-30">
          <Plus />
        </button>
      </div>
    </div>
  );
}
