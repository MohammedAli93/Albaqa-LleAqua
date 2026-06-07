import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Users, Coins, Swords, ChevronLeft, type LucideIcon } from 'lucide-react';
import { GameType, GameMode } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Brand } from '../components/Brand.js';

export interface SetupSelection {
  type: GameType;
  mode: GameMode;
  /** TEAMS only: host-entered team names (≥2). */
  teamNames?: string[];
  /** Fill the room with auto-playing bots and start (solo testing). */
  demo?: boolean;
}

/**
 * Big-screen game creation.
 *   1) game TYPE (Individual / Teams) — big visual cards.
 *   2a) INDIVIDUAL → pick a mode (Points / Elimination).
 *   2b) TEAMS → name the teams, then create (team mode is always points).
 */
export function Setup({
  onConfirm,
  initialType = null,
}: {
  onConfirm: (sel: SetupSelection) => void;
  initialType?: GameType | null;
}) {
  const { locale } = useStore();
  const [step, setStep] = useState<1 | 2>(initialType ? 2 : 1);
  const [type, setType] = useState<GameType | null>(initialType);
  // Exactly two teams (client requirement): [Team A, Team B].
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [bots, setBots] = useState(false);

  const types: { key: GameType; icon: LucideIcon; title: string; tagline: string; grad: string }[] = [
    { key: GameType.INDIVIDUAL, icon: User, title: t(locale, 'individual'), tagline: t(locale, 'individualTagline'), grad: 'from-brand-violet to-brand-deep' },
    { key: GameType.TEAMS, icon: Users, title: t(locale, 'teams'), tagline: t(locale, 'teamsTagline'), grad: 'from-action-hot to-action' },
  ];
  const modes: { key: GameMode; icon: LucideIcon; title: string; desc: string; tint: string }[] = [
    { key: GameMode.POINTS, icon: Coins, title: t(locale, 'pointsGame'), desc: t(locale, 'pointsGameDesc'), tint: 'text-brand-deep' },
    { key: GameMode.ELIMINATION, icon: Swords, title: t(locale, 'eliminationGame'), desc: t(locale, 'eliminationGameDesc'), tint: 'text-action' },
  ];

  const title =
    step === 1
      ? t(locale, 'chooseGameType')
      : type === GameType.TEAMS
        ? t(locale, 'nameTeams')
        : t(locale, 'chooseGameMode');

  function createTeams() {
    const names = [teamA.trim() || 'الفريق الأول', teamB.trim() || 'الفريق الثاني'];
    onConfirm({ type: GameType.TEAMS, mode: GameMode.POINTS, teamNames: names, demo: bots });
  }

  return (
    <div className="safe grid min-h-dvh place-items-center lg:h-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong w-full max-w-3xl rounded-xl4 p-6 lg:p-9"
      >
        {/* Game-name logo on top, then the step title */}
        <div className="relative mb-5 flex flex-col items-center gap-2 text-center lg:mb-7">
          {step === 2 && !initialType && (
            <button
              onClick={() => setStep(1)}
              className="absolute end-0 top-1 flex shrink-0 items-center gap-1.5 rounded-2xl bg-bg-sunken px-3.5 py-2 text-base text-ink-secondary lg:px-4 lg:text-lg"
            >
              <ChevronLeft size={20} /> {t(locale, 'back')}
            </button>
          )}
          <Brand className="text-[clamp(1.6rem,3vw,3rem)]" />
          <h1 className="font-display text-xl font-black text-ink-secondary lg:text-2xl">{title}</h1>
        </div>

        {step === 1 ? (
          // ── Step 1: type — simple one-tap cards (icon → title → tagline) ──
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
            {types.map((ty) => {
              const Icon = ty.icon;
              return (
                <button
                  key={ty.key}
                  onClick={() => { setType(ty.key); setStep(2); }}
                  className="group glass flex flex-col items-center gap-3 rounded-xl3 p-6 text-center transition hover:-translate-y-1 hover:shadow-glow lg:gap-4 lg:p-7"
                >
                  <span className={`grid h-20 w-20 place-items-center rounded-[1.6rem] bg-gradient-to-br ${ty.grad} text-white shadow-glow transition group-hover:scale-105 lg:h-24 lg:w-24`}>
                    <Icon className="h-10 w-10 lg:h-12 lg:w-12" strokeWidth={2.2} />
                  </span>
                  <span className="font-display text-3xl font-black lg:text-4xl">{ty.title}</span>
                  <span className="font-display text-base font-bold text-ink-secondary lg:text-xl">{ty.tagline}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4 lg:space-y-6">
            <BotsToggle bots={bots} onToggle={() => setBots((b) => !b)} />

            {type === GameType.TEAMS ? (
              // ── Step 2b: name exactly two teams, then create (points only) ──
              <>
                <div className="space-y-4">
                  <TeamNameField
                    color={TEAM_TINT[0]!} badge="A"
                    label={t(locale, 'teamAName')} placeholder={t(locale, 'teamAPlaceholder')}
                    value={teamA} onChange={(v) => setTeamA(v.slice(0, 24))}
                  />
                  <TeamNameField
                    color={TEAM_TINT[1]!} badge="B"
                    label={t(locale, 'teamBName')} placeholder={t(locale, 'teamBPlaceholder')}
                    value={teamB} onChange={(v) => setTeamB(v.slice(0, 24))}
                  />
                </div>

                <button
                  onClick={createTeams}
                  className="w-full rounded-2xl bg-gradient-brand py-5 font-display text-2xl font-black text-white shadow-glow transition hover:scale-[1.02] lg:text-3xl"
                >
                  {t(locale, 'createRoomBtn')}
                </button>
              </>
            ) : (
              // ── Step 2a: individual mode pick ──
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
                {modes.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.key}
                      onClick={() => onConfirm({ type: GameType.INDIVIDUAL, mode: m.key, demo: bots })}
                      className="glass flex flex-col items-center gap-3 rounded-xl3 p-6 text-center transition hover:-translate-y-1 hover:shadow-glow lg:gap-4 lg:p-10"
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
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

const TEAM_TINT = ['#4F46E5', '#FB7185'];

function TeamNameField({
  color, badge, label, placeholder, value, onChange,
}: {
  color: string; badge: string; label: string; placeholder: string;
  value: string; onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <span
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl font-display text-2xl font-black text-white lg:h-16 lg:w-16"
        style={{ background: color }}
      >
        {badge}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="auto"
        placeholder={placeholder}
        aria-label={label}
        className="w-full rounded-2xl bg-bg-sunken px-5 py-4 text-xl font-bold text-ink-primary outline-none focus:ring-2 focus:ring-brand-deep lg:text-2xl"
      />
    </label>
  );
}

function BotsToggle({ bots, onToggle }: { bots: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={[
        'flex w-full items-center justify-between gap-3 rounded-xl3 p-4 text-start transition lg:p-6',
        bots ? 'bg-gradient-brand text-white shadow-glow' : 'glass',
      ].join(' ')}
    >
      <span>
        <span className="block font-display text-xl font-extrabold lg:text-2xl">🤖 جرّب مع لاعبين آليين</span>
        <span className={`text-base lg:text-lg ${bots ? 'text-white/80' : 'text-ink-secondary'}`}>
          نملأ الغرفة بلاعبين آليين للتجربة بدون أشخاص
        </span>
      </span>
      <span className={['relative h-9 w-16 shrink-0 rounded-full transition', bots ? 'bg-white/40' : 'bg-ink-muted/30'].join(' ')}>
        <span className={['absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all', bots ? 'left-1' : 'left-8'].join(' ')} />
      </span>
    </button>
  );
}
