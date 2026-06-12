import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Skull, Trophy } from 'lucide-react';
import { GameType, GameMode } from '@tahaddi/shared';
import type { RankedEntry, TeamPublic, PublicParticipant } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';
import { Hearts } from '../components/Hearts.js';
import { ConfettiRain } from '../components/Confetti.js';

// The end-game showcase is rendered in Arabic (client request 2026-06-12).
const L = 'ar' as const;

/** Eased count-up number for the dramatic score reveal. */
function CountUp({ value, className }: { value: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1200;
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
 * End-game showcase (client-requested flow): the room FIRST sees the champion
 * celebration — 🏆 Champion + name — and ONLY AFTER that the full ranking
 * (1st/2nd/3rd podium). The two stages auto-cycle. Three variants: individual
 * points, individual elimination, teams.
 */
export function Winner() {
  const { winner, leaderboard, teams, type, mode } = useStore();
  const [stage, setStage] = useState<'champion' | 'ranking'>('champion');

  // Champion holds a beat first, then the ranking lingers longer, then repeat.
  useEffect(() => {
    const hold = stage === 'champion' ? 5500 : 9000;
    const id = window.setTimeout(() => setStage((s) => (s === 'champion' ? 'ranking' : 'champion')), hold);
    return () => window.clearTimeout(id);
  }, [stage]);

  if (!winner) return null;
  const isTeams = type === GameType.TEAMS;
  const isElim = mode === GameMode.ELIMINATION;

  return (
    <div
      className="safe relative grid min-h-dvh place-items-center overflow-y-auto overflow-x-hidden p-5 lg:h-full lg:p-8"
      style={{ backgroundImage: 'linear-gradient(165deg, #0284C7 0%, #0EA5E9 48%, #38BDF8 100%)' }}
    >
      {/* spotlight + glows behind the podium */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-10%] h-[60vh] w-[70vw] -translate-x-1/2 rounded-full bg-white/20 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-[-10%] left-1/2 h-[40vh] w-[80vw] -translate-x-1/2 rounded-full bg-prize-gold/20 blur-[120px]" />
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
            <ChampionFocus winner={winner.winner} team={winner.winnerTeam} isTeams={isTeams} isElim={isElim} />
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
              <TeamResult teams={teams} leaderboard={leaderboard} winnerTeam={winner.winnerTeam} />
            ) : (
              <PlayerResult leaderboard={leaderboard} isElim={isElim} />
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
 * Stage 1 — the climax. The room sees 🏆 Champion + the winner's name BEFORE any
 * ranking, so the celebration lands before the leaderboard.
 */
function ChampionFocus({
  winner, team, isTeams, isElim,
}: {
  winner: PublicParticipant | null;
  team: TeamPublic | null;
  isTeams: boolean;
  isElim: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-3 text-center lg:gap-5">
      <Headline title={isTeams ? t(L, 'winningTeam') : t(L, 'champion')} />

      {isTeams && team ? (
        <>
          <div className="grid h-24 w-24 place-items-center rounded-full shadow-gold lg:h-36 lg:w-36" style={{ background: team.color }}>
            <Crown color="white" className="h-12 w-12 lg:h-20 lg:w-20" />
          </div>
          <h2 className="max-w-full break-words font-display text-[clamp(2.25rem,4vw,4.25rem)] font-black" style={{ color: team.color }}>{team.name}</h2>
          <p className="tnum font-display text-screen-score font-black text-white drop-shadow"><CountUp value={team.score} /> {t(L, 'points')}</p>
        </>
      ) : winner ? (
        <>
          <div className="scale-110 lg:scale-[1.35]">
            <Avatar avatarId={winner.avatarId} size={120} />
          </div>
          <h2 className="max-w-full break-words font-display text-[clamp(2.25rem,4vw,4.25rem)] font-black text-gold-gradient">{winner.nickname}</h2>
          {isElim ? (
            <Hearts lives={winner.lives} size={48} />
          ) : (
            <p className="tnum font-display text-screen-score font-black text-white drop-shadow"><CountUp value={winner.score} /> {t(L, 'points')}</p>
          )}
        </>
      ) : null}

      <p className="mt-1 font-display text-screen-status font-bold text-white animate-pulse-glow">
        {t(L, 'congratulations')}
      </p>
    </div>
  );
}

// ─────────────────────────────── Individual ──────────────────────────────────

/**
 * Stage 2 — a plain, readable ranking list (client request 2026-06-12: NOT the
 * podium). One row per player: rank number, avatar, name, score. The champion's
 * row is gold-ringed and labelled, everyone else is a calm row.
 */
function PlayerResult({ leaderboard, isElim }: { leaderboard: RankedEntry[]; isElim: boolean }) {
  if (leaderboard.length === 0) return null;

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center">
      <Headline title={t(L, 'finalRanking')} />
      <div className="flex w-full flex-col gap-2.5 lg:gap-3">
        {leaderboard.map((e, i) => {
          const out = e.status === 'ELIMINATED';
          const champ = e.rank === 1 && !out;
          return (
            <motion.div
              key={e.participantId}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: out ? 0.5 : 1, x: 0 }}
              transition={{ delay: Math.min(0.15 + i * 0.07, 1.4) }}
              className={`glass-strong flex items-center gap-3 rounded-xl2 p-3 lg:gap-4 lg:p-4 ${champ ? 'ring-2 ring-prize-gold shadow-gold' : ''}`}
            >
              <span className={`tnum w-10 text-center font-display text-screen-ranknum font-black ${champ ? 'text-gold-gradient' : 'text-ink-muted'}`}>{e.rank}</span>
              <Avatar avatarId={e.avatarId} size={52} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-display text-screen-rankname font-bold">{e.nickname}</span>
                {champ ? (
                  <span className="font-display text-screen-meta font-black text-prize-gold">{t(L, 'champion')} 🏆</span>
                ) : (
                  <span className="font-display text-screen-meta text-ink-muted">{t(L, 'betterLuck')}</span>
                )}
              </div>
              {isElim ? (
                out ? <Skull className="shrink-0 text-danger" size={26} /> : <Hearts lives={e.lives} size={24} />
              ) : (
                <span className="tnum font-display text-screen-score font-black">
                  {champ ? <CountUp value={e.score} /> : e.score} <span className="text-screen-meta font-semibold text-ink-muted">{t(L, 'points')}</span>
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────── Teams ──────────────────────────────────────

function Headline({ title }: { title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 16 }}
      className="mb-5 flex flex-col items-center gap-1 lg:mb-8"
    >
      <motion.div animate={{ y: [0, -10, 0], rotate: [-3, 3, -3] }} transition={{ duration: 3, repeat: Infinity }}>
        <Trophy className="h-[1.05em] w-[1.05em] text-[clamp(3rem,5.5vw,6rem)] text-prize-gold" style={{ filter: 'drop-shadow(0 0 36px rgba(245,197,24,0.9))' }} />
      </motion.div>
      <h1 className="w-full text-center font-display text-[clamp(3rem,5.5vw,6rem)] font-black text-gold-gradient" style={{ filter: 'drop-shadow(0 6px 30px rgba(245,158,11,0.35))' }}>
        {title}
      </h1>
    </motion.div>
  );
}

/**
 * Teams result — a plain ranking list (client request 2026-06-12: NOT towers).
 * One row per team: rank, team name (in its colour), members, score. The winning
 * team's row is gold-ringed and crowned.
 */
function TeamResult({
  teams,
  leaderboard,
  winnerTeam,
}: {
  teams: TeamPublic[];
  leaderboard: RankedEntry[];
  winnerTeam: TeamPublic | null;
}) {
  const all = teams.length > 0 ? teams : winnerTeam ? [winnerTeam] : [];
  const ranked = [...all].sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return null;
  const membersOf = (teamId: string) => leaderboard.filter((e) => e.teamId === teamId);

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center">
      <Headline title={t(L, 'finalRanking')} />
      <div className="flex w-full flex-col gap-2.5 lg:gap-3">
        {ranked.map((team, i) => {
          const champ = i === 0;
          const members = membersOf(team.id);
          return (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(0.15 + i * 0.08, 1.4) }}
              className={`glass-strong flex items-center gap-3 rounded-xl2 p-3.5 lg:gap-4 lg:p-4 ${champ ? 'ring-2 ring-prize-gold shadow-gold' : ''}`}
              style={{ borderInlineStart: `7px solid ${team.color}` }}
            >
              <span className={`tnum w-10 text-center font-display text-screen-ranknum font-black ${champ ? 'text-gold-gradient' : 'text-ink-muted'}`}>{i + 1}</span>
              {champ && <Crown className="shrink-0 text-prize-gold" style={{ filter: 'drop-shadow(0 0 12px rgba(245,197,24,0.8))' }} />}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-display text-screen-team font-black" style={{ color: team.color }}>{team.name}</span>
                {champ ? (
                  members.length > 0 && (
                    <span className="truncate font-display text-screen-meta font-semibold text-ink-muted">
                      {members.map((m) => m.nickname).join('، ')}
                    </span>
                  )
                ) : (
                  <span className="font-display text-screen-meta text-ink-muted">{t(L, 'betterLuck')}</span>
                )}
              </div>
              <span className="tnum font-display text-screen-score font-black">
                {champ ? <CountUp value={team.score} /> : team.score} <span className="text-screen-meta font-semibold text-ink-muted">{t(L, 'points')}</span>
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
