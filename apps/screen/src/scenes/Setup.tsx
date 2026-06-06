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
  /** Fill the room with auto-playing bots and start (solo testing). */
  demo?: boolean;
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
  const [bots, setBots] = useState(false);

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
        ? { type, mode, teamCount, playersPerTeam, demo: bots }
        : { type: type!, mode, demo: bots },
    );
  }

  return (
    <div className="safe grid min-h-dvh place-items-center lg:h-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong w-full max-w-4xl rounded-xl4 p-6 lg:p-12"
      >
        <div className="mb-6 flex items-center justify-between gap-3 lg:mb-8">
          <h1 className="font-display text-3xl font-black text-gradient lg:text-5xl">
            {step === 1 ? t(locale, 'chooseGameType') : t(locale, 'chooseGameMode')}
          </h1>
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="flex shrink-0 items-center gap-2 rounded-2xl bg-bg-sunken px-4 py-2 text-lg text-ink-secondary lg:px-5 lg:py-3 lg:text-2xl"
            >
              <ChevronLeft /> {t(locale, 'back')}
            </button>
          )}
        </div>

        {step === 1 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
            {types.map((ty) => {
              const Icon = ty.icon;
              return (
                <button
                  key={ty.key}
                  onClick={() => { setType(ty.key); setStep(2); }}
                  className="glass flex flex-col items-center gap-3 rounded-xl3 p-6 transition hover:-translate-y-1 hover:shadow-glow lg:gap-4 lg:p-10"
                >
                  <span className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-brand text-white lg:h-24 lg:w-24">
                    <Icon className="h-7 w-7 lg:h-12 lg:w-12" />
                  </span>
                  <span className="font-display text-2xl font-extrabold lg:text-3xl">{ty.title}</span>
                  <span className="text-center text-base text-ink-secondary lg:text-xl">{ty.desc}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4 lg:space-y-6">
            {/* Solo testing: fill with auto-playing bots */}
            <button
              onClick={() => setBots((b) => !b)}
              className={[
                'flex w-full items-center justify-between gap-3 rounded-xl3 p-4 text-start transition lg:p-6',
                bots ? 'bg-gradient-brand text-white shadow-glow' : 'glass',
              ].join(' ')}
            >
              <span>
                <span className="block font-display text-xl font-extrabold lg:text-2xl">🤖 اختبر مع بوتات</span>
                <span className={`text-base lg:text-lg ${bots ? 'text-white/80' : 'text-ink-secondary'}`}>
                  املأ الغرفة بلاعبين آليين وابدأ تلقائياً — للتجربة بدون أشخاص
                </span>
              </span>
              <span
                className={[
                  'relative h-9 w-16 shrink-0 rounded-full transition',
                  bots ? 'bg-white/40' : 'bg-ink-muted/30',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all',
                    bots ? 'left-1' : 'left-8',
                  ].join(' ')}
                />
              </span>
            </button>

            {type === GameType.TEAMS && (
              <div className="glass flex flex-col items-center gap-4 rounded-xl3 p-5 lg:flex-row lg:justify-around lg:p-6">
                <Stepper label={t(locale, 'teamCount')} value={teamCount} min={GAME_LIMITS.MIN_TEAMS} max={GAME_LIMITS.MAX_TEAMS} onChange={setTeamCount} />
                <div className="hidden h-16 w-px bg-ink-muted/15 lg:block" />
                <Stepper label={t(locale, 'playersPerTeam')} value={playersPerTeam} min={GAME_LIMITS.MIN_PLAYERS_PER_TEAM} max={GAME_LIMITS.MAX_PLAYERS_PER_TEAM} onChange={setPlayersPerTeam} />
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
              {modes.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.key}
                    onClick={() => confirm(m.key)}
                    className="glass flex flex-col items-center gap-3 rounded-xl3 p-6 transition hover:-translate-y-1 hover:shadow-glow lg:gap-4 lg:p-10"
                  >
                    <span className="grid h-16 w-16 place-items-center rounded-3xl bg-white shadow-glass lg:h-24 lg:w-24">
                      <Icon className={`h-7 w-7 lg:h-12 lg:w-12 ${m.tint}`} />
                    </span>
                    <span className="font-display text-2xl font-extrabold lg:text-3xl">{m.title}</span>
                    <span className="text-center text-base text-ink-secondary lg:text-xl">{m.desc}</span>
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
