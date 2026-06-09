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

const MEDALS = ['🥇', '🥈', '🥉'];
function RankBadge({ rank, size = 'md' }: { rank: number; size?: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-4xl lg:text-5xl' : 'text-2xl lg:text-3xl';
  if (rank <= 3) return <span className={cls}>{MEDALS[rank - 1]}</span>;
  return (
    <span className={`tnum grid place-items-center font-display font-black text-ink-secondary ${size === 'lg' ? 'h-12 w-12 text-3xl' : 'h-9 w-9 text-2xl'}`}>
      {rank}
    </span>
  );
}

/**
 * End-game showcase — a cycling carousel (client-requested flow):
 *   Stage 1: Champion focus → Stage 2: Full ranking → cycle back to champion.
 * One component, three variants: individual points, individual elimination, teams.
 */
export function Winner() {
  const { winner, leaderboard, teams, type, mode, locale } = useStore();
  const [stage, setStage] = useState<'champion' | 'ranking'>('champion');

  // Auto-cycle: champion holds a beat, ranking lingers a little longer, repeat.
  useEffect(() => {
    const hold = stage === 'champion' ? 5500 : 8500;
    const id = window.setTimeout(() => setStage((s) => (s === 'champion' ? 'ranking' : 'champion')), hold);
    return () => window.clearTimeout(id);
  }, [stage]);

  if (!winner) return null;
  const isTeams = type === GameType.TEAMS;
  const isElim = mode === GameMode.ELIMINATION;

  return (
    <div
      className="relative grid min-h-dvh place-items-center overflow-hidden p-5 lg:h-full lg:p-0"
      style={{ backgroundImage: 'linear-gradient(165deg, #4F46E5 0%, #6D28D9 48%, #DB2777 100%)' }}
    >
      <ConfettiRain />
      <AnimatePresence mode="wait">
        {stage === 'champion' ? (
          <motion.div
            key="champion"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 150, damping: 18 }}
            className="w-full"
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
            className="w-full"
          >
            {isTeams ? (
              <TeamRanking teams={teams} leaderboard={leaderboard} locale={locale} />
            ) : (
              <PlayerRanking leaderboard={leaderboard} isElim={isElim} locale={locale} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage indicator dots */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
        {(['champion', 'ranking'] as const).map((s) => (
          <span key={s} className={`h-2.5 rounded-full transition-all ${stage === s ? 'w-6 bg-prize-gold' : 'w-2.5 bg-white/40'}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * Stage 1 — the climax. The FIRST thing the room sees is 🏆 البطل, oversized and
 * high-contrast at the very top, THEN the avatar + name. Order and size make the
 * title the unmistakable headline of the screen.
 */
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
    <div className="flex w-full max-w-4xl flex-col items-center gap-3 text-center lg:gap-5">
      {/* 🏆 البطل — the headline, top of the layout, biggest thing on screen */}
      <div className="flex flex-col items-center gap-2 lg:gap-3">
        <motion.div
          animate={{ y: [0, -12, 0], rotate: [-3, 3, -3] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Trophy className="h-[1.1em] w-[1.1em] text-screen-champion text-prize-gold" style={{ filter: 'drop-shadow(0 0 36px rgba(245,197,24,0.9))' }} />
        </motion.div>
        <motion.h1
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          className="font-display text-screen-champion font-black text-gold-gradient"
          style={{ filter: 'drop-shadow(0 6px 30px rgba(245,158,11,0.35))' }}
        >
          {isTeams ? t(locale, 'winningTeam') : t(locale, 'champion')}
        </motion.h1>
      </div>

      {isTeams && team ? (
        <>
          <div className="grid h-24 w-24 place-items-center rounded-full shadow-gold lg:h-36 lg:w-36" style={{ background: team.color }}>
            <Crown color="white" className="h-12 w-12 lg:h-20 lg:w-20" />
          </div>
          <h2 className="max-w-full break-words font-display text-screen-name font-black" style={{ color: team.color }}>{team.name}</h2>
          <p className="tnum font-display text-screen-score font-black"><CountUp value={team.score} /> {t(locale, 'points')}</p>
        </>
      ) : winner ? (
        <>
          <div className="scale-110 lg:scale-[1.7]">
            <Avatar avatarId={winner.avatarId} size={120} />
          </div>
          <h2 className="max-w-full break-words font-display text-screen-name font-black text-gold-gradient">{winner.nickname}</h2>
          {isElim ? (
            <Hearts lives={winner.lives} size={48} />
          ) : (
            <p className="tnum font-display text-screen-score font-black"><CountUp value={winner.score} /> {t(locale, 'points')}</p>
          )}
        </>
      ) : null}

      <p className="mt-1 font-display text-screen-status font-bold text-white animate-pulse-glow">
        {t(locale, 'congratulations')}
      </p>
    </div>
  );
}

/** Stage 2 (individual) — full ranking. Points: scores. Elimination: hearts + labels. */
function PlayerRanking({ leaderboard, isElim, locale }: { leaderboard: RankedEntry[]; isElim: boolean; locale: Locale }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <h2 className="mb-5 text-center font-display text-screen-title font-black text-white drop-shadow lg:mb-7">{t(locale, 'finalRanking')}</h2>
      <div className="flex flex-col gap-2.5 lg:gap-3">
        {leaderboard.map((e, i) => {
          const out = e.status === 'ELIMINATED';
          const champ = e.rank === 1;
          return (
            <motion.div
              key={e.participantId}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.06, 0.5) }}
              className={`flex items-center gap-3 rounded-xl2 p-3 lg:gap-4 lg:p-4 ${champ ? 'glass-strong ring-2 ring-prize-gold shadow-gold' : 'glass'}`}
            >
              <RankBadge rank={e.rank} size={champ ? 'lg' : 'md'} />
              <Avatar avatarId={e.avatarId} size={52} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-display text-screen-rankname font-bold">{e.nickname}</span>
                {isElim && <span className="font-display text-screen-meta text-ink-muted">{champ ? t(locale, 'champion') : t(locale, 'betterLuck')}</span>}
              </div>
              {isElim ? (
                out ? <Skull className="shrink-0 text-danger" size={28} /> : <Hearts lives={e.lives} size={26} />
              ) : (
                <span className="tnum font-display text-screen-score font-black">{e.score} <span className="text-screen-meta font-semibold text-ink-muted">{t(locale, 'points')}</span></span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/** Stage 2 (teams) — team rankings with contributing player names. */
function TeamRanking({ teams, leaderboard, locale }: { teams: TeamPublic[]; leaderboard: RankedEntry[]; locale: Locale }) {
  const ranked = [...teams].sort((a, b) => b.score - a.score);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <h2 className="mb-5 text-center font-display text-screen-title font-black text-white drop-shadow lg:mb-7">{t(locale, 'finalRanking')}</h2>
      <div className="flex flex-col gap-3 lg:gap-4">
        {ranked.map((team, i) => {
          const members = leaderboard.filter((e) => e.teamId === team.id);
          const champ = i === 0;
          return (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`glass-strong rounded-xl3 p-4 lg:p-6 ${champ ? 'shadow-gold ring-2 ring-prize-gold' : ''}`}
              style={{ borderTop: `7px solid ${team.color}` }}
            >
              <div className="flex items-center gap-3 lg:gap-4">
                <RankBadge rank={i + 1} size="lg" />
                <span className="min-w-0 flex-1 truncate font-display text-screen-team font-black" style={{ color: team.color }}>{team.name}</span>
                {champ && <Crown className="shrink-0 text-prize-gold" />}
                <span className="tnum font-display text-screen-score font-black">{team.score} <span className="text-screen-meta font-semibold text-ink-muted">{t(locale, 'points')}</span></span>
              </div>
              {/* Contributing players — names only (the score is team-owned). */}
              {members.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {members.map((m) => (
                    <span key={m.participantId} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-display text-screen-meta font-semibold shadow-glass">
                      <Avatar avatarId={m.avatarId} size={26} /> {m.nickname}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
