import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Skull, Trophy } from 'lucide-react';
import { GameType, GameMode } from '@tahaddi/shared';
import type { RankedEntry, TeamPublic, PublicParticipant } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import type { Locale } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';
import { Hearts } from '../components/Hearts.js';
import { ConfettiRain } from '../components/Confetti.js';
import { HostBg } from '../components/HostBg.js';
import { GoldTitle, LeaderRow, avatarColor } from '../components/desert.js';

/** Eased count-up number for the dramatic score reveal. */
function CountUp({ value, className }: { value: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1100;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{n}</span>;
}

/**
 * End-game showcase — a cycling carousel: Champion focus → full ranking → repeat.
 */
export function Winner() {
  const { winner, leaderboard, teams, type, mode, locale } = useStore();
  const [stage, setStage] = useState<'champion' | 'ranking'>('champion');

  useEffect(() => {
    const hold = stage === 'champion' ? 5500 : 8500;
    const id = window.setTimeout(() => setStage((s) => (s === 'champion' ? 'ranking' : 'champion')), hold);
    return () => window.clearTimeout(id);
  }, [stage]);

  if (!winner) return null;
  const isTeams = type === GameType.TEAMS;
  const isElim = mode === GameMode.ELIMINATION;

  return (
    <div className="safe relative grid min-h-dvh place-items-center overflow-hidden p-5 lg:h-full lg:p-8">
      <HostBg variant="sky" />
      <ConfettiRain />
      <AnimatePresence mode="wait">
        {stage === 'champion' ? (
          <motion.div
            key="champion"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 150, damping: 18 }}
            className="relative z-10 w-full"
          >
            <Champion winner={winner.winner} team={winner.winnerTeam} isTeams={isTeams} isElim={isElim} locale={locale} />
          </motion.div>
        ) : (
          <motion.div
            key="ranking"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="relative z-10 w-full"
          >
            {isTeams ? (
              <TeamRanking teams={teams} leaderboard={leaderboard} locale={locale} />
            ) : (
              <PlayerRanking leaderboard={leaderboard} isElim={isElim} locale={locale} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
        {(['champion', 'ranking'] as const).map((s) => (
          <span key={s} className={`h-2.5 rounded-full transition-all ${stage === s ? 'w-6 bg-[#F6C43E]' : 'w-2.5 bg-white/50'}`} />
        ))}
      </div>
    </div>
  );
}

function Headline({ title }: { title: string }) {
  return (
    <div className="mb-5 flex flex-col items-center gap-1 lg:mb-7">
      <motion.div animate={{ y: [0, -12, 0], rotate: [-3, 3, -3] }} transition={{ duration: 3, repeat: Infinity }}>
        <Trophy className="h-[1.1em] w-[1.1em] text-[clamp(3rem,5.5vw,6rem)] text-[#F6C43E]" style={{ filter: 'drop-shadow(0 0 36px rgba(246,196,62,0.9))' }} />
      </motion.div>
      <GoldTitle className="text-[clamp(3rem,5.5vw,6rem)]">{title}</GoldTitle>
    </div>
  );
}

function Champion({
  winner, team, isTeams, isElim, locale,
}: {
  winner: PublicParticipant | null;
  team: TeamPublic | null;
  isTeams: boolean;
  isElim: boolean;
  locale: Locale;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-3 text-center lg:gap-5">
      <Headline title={isTeams ? t(locale, 'winningTeam') : t(locale, 'champion')} />

      {isTeams && team ? (
        <>
          <div className="grid h-24 w-24 place-items-center rounded-[26%] shadow-[0_18px_36px_-14px_rgba(0,0,0,0.5),inset_0_2px_2px_rgba(255,255,255,0.4)] lg:h-36 lg:w-36" style={{ background: `linear-gradient(160deg, ${team.color}dd, ${team.color})` }}>
            <Crown color="white" className="h-12 w-12 lg:h-20 lg:w-20" />
          </div>
          <h2 className="max-w-full break-words font-display text-[clamp(2.25rem,4vw,4.25rem)] font-black" style={{ color: '#FFE9A8' }}>{team.name}</h2>
          <p className="tnum font-display text-screen-score font-black text-[#FFE9A8] drop-shadow"><CountUp value={team.score} /> {t(locale, 'points')}</p>
        </>
      ) : winner ? (
        <>
          <div className="scale-110 lg:scale-[1.35]">
            <Avatar avatarId={winner.avatarId} size={120} shape="square" />
          </div>
          <h2 className="max-w-full break-words font-display text-[clamp(2.25rem,4vw,4.25rem)] font-black" style={{ color: '#FFE9A8' }}>{winner.nickname}</h2>
          {isElim ? (
            <Hearts lives={winner.lives} size={48} />
          ) : (
            <p className="tnum font-display text-screen-score font-black text-[#FFE9A8] drop-shadow"><CountUp value={winner.score} /> {t(locale, 'points')}</p>
          )}
        </>
      ) : null}

      <p className="mt-1 font-display text-screen-status font-bold text-white animate-pulse-glow">
        {t(locale, 'congratulations')}
      </p>
    </div>
  );
}

function PlayerRanking({ leaderboard, isElim, locale }: { leaderboard: RankedEntry[]; isElim: boolean; locale: Locale }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
      <Headline title={t(locale, 'finalRanking')} />
      <div className="flex max-h-[62vh] w-full flex-col gap-2.5 overflow-y-auto px-0.5 pb-1 lg:gap-3">
        {leaderboard.map((e) => {
          const out = e.status === 'ELIMINATED';
          const champ = e.rank === 1 && !out;
          return (
            <LeaderRow
              key={e.participantId}
              rank={e.rank}
              name={e.nickname}
              color={champ ? '#F6A41C' : avatarColor(e.avatarId)}
              avatar={<Avatar avatarId={e.avatarId} size={52} shape="square" />}
              highlight={champ}
              dimmed={out}
              badge={champ ? <Crown className="shrink-0 text-[#FFE9A8]" /> : undefined}
              value={isElim ? (out ? <Skull size={24} /> : <Hearts lives={e.lives} size={24} />) : e.score}
            />
          );
        })}
      </div>
    </div>
  );
}

function TeamRanking({ teams, leaderboard, locale }: { teams: TeamPublic[]; leaderboard: RankedEntry[]; locale: Locale }) {
  const ranked = [...teams].sort((a, b) => b.score - a.score);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
      <Headline title={t(locale, 'finalRanking')} />
      <div className="flex max-h-[62vh] w-full flex-col gap-3 overflow-y-auto px-0.5 pb-1">
        {ranked.map((team, i) => {
          const members = leaderboard.filter((e) => e.teamId === team.id);
          const champ = i === 0;
          return (
            <div
              key={team.id}
              className={`flex flex-col gap-2 rounded-[1.5rem] p-3.5 text-white shadow-[0_18px_34px_-16px_rgba(0,0,0,0.5),inset_0_2px_1px_rgba(255,255,255,0.3)] lg:p-4 ${champ ? 'ring-4 ring-[#FFE9A8]' : ''}`}
              style={{ background: `linear-gradient(180deg, ${team.color}cc, ${team.color})` }}
            >
              <div className="flex items-center gap-3 lg:gap-4">
                <span className="tnum w-9 text-center font-display text-screen-ranknum font-black lg:w-12">{i + 1}</span>
                {champ && <Crown className="shrink-0 text-[#FFE9A8]" />}
                <span className="min-w-0 flex-1 truncate font-display text-screen-team font-black">{team.name}</span>
                <span className="tnum shrink-0 font-display text-screen-score font-black">
                  {champ ? <CountUp value={team.score} /> : team.score} <span className="text-screen-meta font-bold text-white/80">{t(locale, 'points')}</span>
                </span>
              </div>
              {members.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 ps-[3.25rem] text-white/85">
                  {members.map((m) => (
                    <span key={m.participantId} className="truncate font-display text-screen-meta font-bold">{m.nickname}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
