import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Users, Coins, Swords, ChevronLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GameType, GameMode } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { HostBg } from '../components/HostBg.js';

export interface SetupSelection {
  type: GameType;
  mode: GameMode;
  /** TEAMS only: host-entered team names (≥2). */
  teamNames?: string[];
  /** Fill the room with auto-playing bots and start (solo testing). */
  demo?: boolean;
}

const CARD_BG = 'linear-gradient(180deg,#FFE49C 0%,#FFEEBE 55%,#FFF6DC 100%)';
const RED_BTN = 'linear-gradient(180deg,#F2796C 0%,#E8473A 100%)';

/**
 * Big-screen game creation — rebuilt to the Figma desert comp (بقاء الأقوى1 9·9-1).
 *   1) game TYPE (Individual / Teams) — big visual cards.
 *   2a) INDIVIDUAL → pick a mode (Points / Elimination).
 *   2b) TEAMS → name the two teams on the orange-dunes plate, then create.
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

  const isTeams = type === GameType.TEAMS;

  const types: { key: GameType; icon: LucideIcon; title: string; tagline: string; grad: string }[] = [
    { key: GameType.INDIVIDUAL, icon: User, title: t(locale, 'individual'), tagline: t(locale, 'individualTagline'), grad: 'linear-gradient(135deg,#5BBDEE,#2E97D4)' },
    { key: GameType.TEAMS, icon: Users, title: t(locale, 'teams'), tagline: t(locale, 'teamsTagline'), grad: RED_BTN },
  ];
  const modes: { key: GameMode; icon: LucideIcon; title: string; desc: string; tint: string }[] = [
    { key: GameMode.POINTS, icon: Coins, title: t(locale, 'pointsGame'), desc: t(locale, 'pointsGameDesc'), tint: 'text-[#2E97D4]' },
    { key: GameMode.ELIMINATION, icon: Swords, title: t(locale, 'eliminationGame'), desc: t(locale, 'eliminationGameDesc'), tint: 'text-[#E8473A]' },
  ];

  const subtitle =
    step === 1
      ? t(locale, 'chooseGameType')
      : isTeams
        ? t(locale, 'nameTeams')
        : t(locale, 'chooseGameMode');

  function createTeams() {
    const names = [teamA.trim() || 'الفريق الأول', teamB.trim() || 'الفريق الثاني'];
    onConfirm({ type: GameType.TEAMS, mode: GameMode.POINTS, teamNames: names, demo: bots });
  }

  return (
    <div className="safe relative grid min-h-dvh place-items-center overflow-hidden p-5 lg:h-full" dir="rtl">
      <HostBg variant={isTeams ? 'team' : 'sky'} />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className="relative z-10 w-full max-w-[40rem] rounded-[2rem] px-6 pb-8 pt-7 shadow-[0_40px_90px_-40px_rgba(120,70,10,0.7)] ring-1 ring-white/50 lg:px-10 lg:pt-9"
        style={{ backgroundImage: CARD_BG }}
      >
        {/* back chevron (only when type is reselectable) */}
        {step === 2 && !initialType && (
          <button
            onClick={() => setStep(1)}
            className="absolute end-5 top-5 flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 font-display text-base font-bold text-desert-ink shadow-sm transition hover:bg-white lg:end-8 lg:top-8"
          >
            <ChevronLeft size={18} /> {t(locale, 'back')}
          </button>
        )}

        {/* our gold wordmark + step subtitle */}
        <img src="/art/logo-wordmark.png" alt="البقاء للأقوى" className="mx-auto h-auto w-[13rem] drop-shadow-sm lg:w-[15rem]" />
        <p className="mt-1.5 text-center font-display text-xl font-extrabold text-desert-ink/70 lg:text-2xl">{subtitle}</p>

        <div className="mt-7">
          {step === 1 ? (
            // ── Step 1: type — one-tap cards (icon → title → tagline) ──
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
              {types.map((ty) => {
                const Icon = ty.icon;
                return (
                  <button
                    key={ty.key}
                    onClick={() => { setType(ty.key); setStep(2); }}
                    className="group flex flex-col items-center gap-3 rounded-[1.5rem] bg-white/70 p-6 text-center shadow-sm backdrop-blur-sm transition hover:-translate-y-1 hover:bg-white hover:shadow-lg lg:gap-4 lg:p-7"
                  >
                    <span className="grid h-20 w-20 place-items-center rounded-[1.6rem] text-white shadow-md transition group-hover:scale-105 lg:h-24 lg:w-24" style={{ backgroundImage: ty.grad }}>
                      <Icon className="h-10 w-10 lg:h-12 lg:w-12" strokeWidth={2.2} />
                    </span>
                    <span className="font-display text-3xl font-black text-desert-ink lg:text-4xl">{ty.title}</span>
                    <span className="font-display text-base font-bold text-desert-ink/60 lg:text-lg">{ty.tagline}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4 lg:space-y-5">
              {/* Bots are a local testing aid only — never expose them in the
                  production build, so a real host can't accidentally fill the room
                  with auto-players (client feedback 2026-07-20). */}
              {import.meta.env.DEV && <BotsToggle bots={bots} onToggle={() => setBots((b) => !b)} />}

              {isTeams ? (
                // ── Step 2b: name exactly two teams, then create (points only) ──
                <>
                  <div className="space-y-3.5">
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

                  <div className="pt-2">
                    <motion.button
                      whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.03, y: -1 }}
                      onClick={createTeams}
                      className="mx-auto block rounded-full px-14 py-3.5 font-display text-xl font-black text-white shadow-[0_16px_34px_-14px_rgba(214,58,34,0.9)] lg:text-2xl"
                      style={{ backgroundImage: RED_BTN }}
                    >
                      {t(locale, 'createRoomBtn')}
                    </motion.button>
                  </div>
                </>
              ) : (
                // ── Step 2a: individual mode pick ──
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
                  {modes.map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.key}
                        onClick={() => onConfirm({ type: GameType.INDIVIDUAL, mode: m.key, demo: bots })}
                        className="flex flex-col items-center gap-3 rounded-[1.5rem] bg-white/70 p-6 text-center shadow-sm backdrop-blur-sm transition hover:-translate-y-1 hover:bg-white hover:shadow-lg lg:gap-4 lg:p-8"
                      >
                        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-white shadow-md lg:h-20 lg:w-20">
                          <Icon className={`h-7 w-7 lg:h-10 lg:w-10 ${m.tint}`} />
                        </span>
                        <span className="font-display text-2xl font-extrabold text-desert-ink lg:text-3xl">{m.title}</span>
                        <span className="text-center text-base text-desert-ink/60 lg:text-lg">{m.desc}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

const TEAM_TINT = ['#4FB3E8', '#F5A93C']; // A = blue, B = orange (Figma badges)

function TeamNameField({
  color, badge, label, placeholder, value, onChange,
}: {
  color: string; badge: string; label: string; placeholder: string;
  value: string; onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-full bg-[#FFF7DF]/90 p-1.5 shadow-[inset_0_2px_5px_rgba(170,120,20,0.18)]">
      <span
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-xl font-black text-white shadow-md lg:h-14 lg:w-14"
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
        className="w-full bg-transparent px-3 py-2 text-right text-lg font-bold text-desert-ink outline-none placeholder:text-desert-ink/35 lg:text-xl"
      />
    </label>
  );
}

function BotsToggle({ bots, onToggle }: { bots: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 rounded-[1.4rem] bg-[#FFF7DF]/90 p-4 text-start shadow-[inset_0_2px_5px_rgba(170,120,20,0.14)] lg:p-5"
    >
      <span
        className={['relative h-9 w-16 shrink-0 rounded-full transition', bots ? 'bg-[#F5A93C]' : 'bg-desert-ink/20'].join(' ')}
      >
        <span className={['absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all', bots ? 'right-1' : 'right-8'].join(' ')} />
      </span>
      <span className="text-right">
        <span className="block font-display text-xl font-extrabold text-desert-ink lg:text-2xl">🤖 جرّب مع لاعبين آليين</span>
        <span className="text-base text-desert-ink/55 lg:text-lg">نملأ الغرفة بلاعبين آليين للتجربة بدون أشخاص</span>
      </span>
    </button>
  );
}
