import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Skull, Trophy } from 'lucide-react';
import { GameType, GameMode } from '@tahaddi/shared';
import type { RankedEntry, TeamPublic, PublicParticipant } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';
import { Hearts } from '../components/Hearts.js';

// The player end screen mirrors the host showcase (client request 2026-06-12):
// the SAME champion-first reveal and the SAME big fonts, then the ranking — for
// both individual and teams. Only difference: the player's own row is marked.
const L = 'ar' as const;

const CONFETTI = ['#F59E0B', '#0EA5E9', '#22C55E', '#FB7185', '#7C3AED', '#38BDF8'];

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Lightweight falling confetti for the winner's phone. */
function Confetti() {
  if (prefersReducedMotion()) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {Array.from({ length: 56 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute top-0 h-2.5 w-2.5 rounded-sm"
          style={{ left: `${(i / 56) * 100}%`, background: CONFETTI[i % CONFETTI.length] }}
          initial={{ y: -30, rotate: 0, opacity: 1 }}
          animate={{ y: '105vh', rotate: 720, opacity: [1, 1, 0] }}
          transition={{ duration: 2.6 + (i % 5) * 0.4, repeat: Infinity, delay: (i % 10) * 0.18, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

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
 * Champion celebration first, then the ranking — the two stages auto-cycle,
 * exactly like the big screen.
 */
export function Finished() {
  const { winner, leaderboard, teams, gameType, gameMode, participantId, myTeamId } = useStore();
  const [stage, setStage] = useState<'champion' | 'ranking'>('champion');

  useEffect(() => {
    const hold = stage === 'champion' ? 5500 : 9000;
    const id = window.setTimeout(() => setStage((s) => (s === 'champion' ? 'ranking' : 'champion')), hold);
    return () => window.clearTimeout(id);
  }, [stage]);

  if (!winner) return null;
  const isTeams = gameType === GameType.TEAMS;
  const isElim = gameMode === GameMode.ELIMINATION;
  const board = winner.finalLeaderboard ?? leaderboard;
  const rankedTeams = winner.teams ?? teams;
  const iWon = isTeams
    ? !!winner.winnerTeam && myTeamId === winner.winnerTeam.id
    : winner.winner?.id === participantId;

  return (
    <div
      className="safe relative grid min-h-dvh place-items-center overflow-y-auto overflow-x-hidden p-5"
      style={{ backgroundImage: 'linear-gradient(165deg, #0284C7 0%, #0EA5E9 48%, #38BDF8 100%)' }}
    >
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-10%] h-[60vh] w-[70vw] -translate-x-1/2 rounded-full bg-white/20 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-[-10%] left-1/2 h-[40vh] w-[80vw] -translate-x-1/2 rounded-full bg-prize-gold/20 blur-[120px]" />
      {iWon && <Confetti />}

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
              <TeamResult teams={rankedTeams} leaderboard={board} winnerTeam={winner.winnerTeam} myTeamId={myTeamId} />
            ) : (
              <PlayerResult leaderboard={board} isElim={isElim} meId={participantId} />
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

/** Stage 1 — the champion (or winning team) shown big, before any ranking. */
function ChampionFocus({
  winner, team, isTeams, isElim,
}: {
  winner: PublicParticipant | null;
  team: TeamPublic | null;
  isTeams: boolean;
  isElim: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-3 text-center">
      <Headline title={isTeams ? t(L, 'winningTeam') : t(L, 'champion')} />

      {isTeams && team ? (
        <>
          <div className="grid h-28 w-28 place-items-center rounded-full shadow-gold" style={{ background: team.color }}>
            <Crown color="white" className="h-14 w-14" />
          </div>
          <h2 className="max-w-full break-words font-display text-[clamp(2.25rem,9vw,4.25rem)] font-black" style={{ color: team.color }}>{team.name}</h2>
          <p className="tnum font-display text-screen-score font-black text-white drop-shadow"><CountUp value={team.score} /> {t(L, 'points')}</p>
        </>
      ) : winner ? (
        <>
          <div className="scale-110">
            <Avatar avatarId={winner.avatarId} size={120} />
          </div>
          <h2 className="max-w-full break-words font-display text-[clamp(2.25rem,9vw,4.25rem)] font-black text-gold-gradient">{winner.nickname}</h2>
          {isElim ? (
            <Hearts lives={winner.lives} size={44} />
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

function Headline({ title }: { title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 16 }}
      className="mb-4 flex flex-col items-center gap-1"
    >
      <motion.div animate={{ y: [0, -10, 0], rotate: [-3, 3, -3] }} transition={{ duration: 3, repeat: Infinity }}>
        <Trophy className="h-[1.05em] w-[1.05em] text-[clamp(3rem,11vw,6rem)] text-prize-gold" style={{ filter: 'drop-shadow(0 0 36px rgba(245,197,24,0.9))' }} />
      </motion.div>
      <h1 className="w-full text-center font-display text-[clamp(2.5rem,11vw,6rem)] font-black text-gold-gradient" style={{ filter: 'drop-shadow(0 6px 30px rgba(245,158,11,0.35))' }}>
        {title}
      </h1>
    </motion.div>
  );
}

// ─────────────────────────────── Individual ──────────────────────────────────

function PlayerResult({ leaderboard, isElim, meId }: { leaderboard: RankedEntry[]; isElim: boolean; meId: string | null }) {
  if (leaderboard.length === 0) return null;

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center">
      <Headline title={t(L, 'finalRanking')} />
      <div className="flex w-full flex-col gap-2.5">
        {leaderboard.map((e, i) => {
          const out = e.status === 'ELIMINATED';
          const champ = e.rank === 1 && !out;
          const mine = e.participantId === meId;
          return (
            <motion.div
              key={e.participantId}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: out ? 0.5 : 1, x: 0 }}
              transition={{ delay: Math.min(0.15 + i * 0.07, 1.4) }}
              className={`glass-strong flex items-center gap-3 rounded-xl2 p-3 ${champ ? 'ring-2 ring-prize-gold shadow-gold' : mine ? 'ring-2 ring-brand-deep' : ''}`}
            >
              <span className={`tnum w-10 text-center font-display text-screen-ranknum font-black ${champ ? 'text-gold-gradient' : 'text-ink-muted'}`}>{e.rank}</span>
              <Avatar avatarId={e.avatarId} size={52} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-display text-screen-rankname font-bold" dir="auto">
                  {e.nickname}
                  {mine && <span className="ms-1.5 text-screen-meta font-bold text-ink-muted">({t(L, 'you')})</span>}
                </span>
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

function TeamResult({
  teams, leaderboard, winnerTeam, myTeamId,
}: {
  teams: TeamPublic[];
  leaderboard: RankedEntry[];
  winnerTeam: TeamPublic | null;
  myTeamId: string | null;
}) {
  const all = teams.length > 0 ? teams : winnerTeam ? [winnerTeam] : [];
  const ranked = [...all].sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return null;
  const membersOf = (teamId: string) => leaderboard.filter((e) => e.teamId === teamId);

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center">
      <Headline title={t(L, 'finalRanking')} />
      <div className="flex w-full flex-col gap-2.5">
        {ranked.map((team, i) => {
          const champ = i === 0;
          const mine = team.id === myTeamId;
          const members = membersOf(team.id);
          return (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(0.15 + i * 0.08, 1.4) }}
              className={`glass-strong flex items-center gap-3 rounded-xl2 p-3.5 ${champ ? 'ring-2 ring-prize-gold shadow-gold' : mine ? 'ring-2 ring-brand-deep' : ''}`}
              style={{ borderInlineStart: `7px solid ${team.color}` }}
            >
              <span className={`tnum w-10 text-center font-display text-screen-ranknum font-black ${champ ? 'text-gold-gradient' : 'text-ink-muted'}`}>{i + 1}</span>
              {champ && <Crown className="shrink-0 text-prize-gold" style={{ filter: 'drop-shadow(0 0 12px rgba(245,197,24,0.8))' }} />}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-display text-screen-team font-black" style={{ color: team.color }}>
                  {team.name}
                  {mine && <span className="ms-1.5 text-screen-meta font-bold text-ink-muted">({t(L, 'you')})</span>}
                </span>
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
