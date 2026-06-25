import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Skull, Trophy, Heart } from 'lucide-react';
import { GameType, GameMode } from '@tahaddi/shared';
import type { RankedEntry, TeamPublic, PublicParticipant } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';
import { Hearts } from '../components/Hearts.js';
import {
  GameShell, GoldHeading, Pill, Squircle, LeaderRow, avatarColor,
} from '../components/desert.js';

// The player end screen mirrors the host showcase: the SAME champion-first reveal
// then the ranking — for both individual and teams. Only the player's own row is marked.
const L = 'ar' as const;
const CONFETTI = ['#F6C43E', '#5BA8F5', '#2FD9A4', '#F2685B', '#A98BF0', '#FBA340'];

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Lightweight falling confetti for the winner's phone. */
function Confetti() {
  if (prefersReducedMotion()) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
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

/** Gold gradient text (scores / champion lines). */
function Gold({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`bg-clip-text font-display font-black text-transparent ${className}`}
      style={{ backgroundImage: 'linear-gradient(180deg,#FFE9A8 0%,#F6C43E 60%,#E89A18 100%)' }}
    >
      {children}
    </span>
  );
}

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
  const championTid = winner.winnerTeam?.id ?? null;
  const championPid = winner.winner?.id ?? null;
  const iWon = isTeams ? !!championTid && myTeamId === championTid : championPid === participantId;
  const myRank = isTeams
    ? [...rankedTeams]
        .sort((a, b) => Number(b.id === championTid) - Number(a.id === championTid) || b.score - a.score)
        .findIndex((tm) => tm.id === myTeamId) + 1
    : [...board]
        .sort((a, b) => Number(b.participantId === championPid) - Number(a.participantId === championPid))
        .findIndex((e) => e.participantId === participantId) + 1;

  return (
    <GameShell className="items-center justify-center">
      {iWon && <Confetti />}
      <div className="relative z-10 flex w-full flex-1 items-center justify-center px-5 py-6">
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
              {iWon ? (
                <ChampionFocus winner={winner.winner} team={winner.winnerTeam} isTeams={isTeams} isElim={isElim} />
              ) : (
                <LoserFocus myRank={myRank} />
              )}
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
                <TeamResult teams={rankedTeams} leaderboard={board} winnerTeam={winner.winnerTeam} myTeamId={myTeamId} championId={championTid} />
              ) : (
                <PlayerResult leaderboard={board} isElim={isElim} meId={participantId} championId={championPid} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stage indicator dots */}
      <div className="relative z-10 mb-5 flex gap-2">
        {(['champion', 'ranking'] as const).map((s) => (
          <span key={s} className={`h-2.5 rounded-full transition-all ${stage === s ? 'w-6 bg-[#F6C43E]' : 'w-2.5 bg-white/50'}`} />
        ))}
      </div>
    </GameShell>
  );
}

/** Stage 1 — the champion (or winning team) shown big (reference screen 23). */
function ChampionFocus({
  winner, team, isTeams, isElim,
}: {
  winner: PublicParticipant | null;
  team: TeamPublic | null;
  isTeams: boolean;
  isElim: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
      <motion.div animate={{ y: [0, -10, 0], rotate: [-4, 4, -4] }} transition={{ duration: 3, repeat: Infinity }}>
        <Trophy size={92} className="text-[#F6C43E]" style={{ filter: 'drop-shadow(0 0 30px rgba(246,196,62,0.85))' }} />
      </motion.div>
      <GoldHeading className="text-5xl">{isTeams ? t(L, 'winningTeam') : 'أنت البطل!'}</GoldHeading>

      {isTeams && team ? (
        <>
          <Squircle size={108} bg={`linear-gradient(160deg, ${team.color}dd, ${team.color})`}>
            <Crown size={52} />
          </Squircle>
          <h2 className="max-w-full break-words font-display text-4xl font-black" style={{ color: '#FFE9A8' }}>{team.name}</h2>
          <Gold className="tnum text-3xl"><CountUp value={team.score} /> {t(L, 'points')}</Gold>
        </>
      ) : winner ? (
        <>
          <Avatar avatarId={winner.avatarId} size={112} shape="square" />
          <h2 className="max-w-full break-words font-display text-4xl font-black" style={{ color: '#FFE9A8' }}>{winner.nickname}</h2>
          {isElim ? (
            <Hearts lives={winner.lives} size={40} />
          ) : (
            <Gold className="tnum text-3xl"><CountUp value={winner.score} /> {t(L, 'points')}</Gold>
          )}
        </>
      ) : null}
    </div>
  );
}

/** The LOSER's screen — calm "better luck next time" + own rank (reference screen 22). */
function LoserFocus({ myRank }: { myRank: number }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-7 text-center">
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 170, damping: 14 }}
      >
        <Heart size={128} className="text-[#F2685B]" fill="currentColor" strokeWidth={0} style={{ filter: 'drop-shadow(0 16px 30px rgba(224,57,44,0.45))' }} />
      </motion.div>
      <h1 className="max-w-[18ch] font-display text-4xl font-black text-[#F2685B]" style={{ filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.25))' }}>
        {t(L, 'betterLuck')}
      </h1>
      {myRank > 0 && <Pill color="green" className="px-8 py-2.5 text-lg">{t(L, 'yourRank', { rank: myRank })}</Pill>}
    </div>
  );
}

// ─────────────────────────────── Individual ──────────────────────────────────

function PlayerResult({ leaderboard, isElim, meId, championId }: { leaderboard: RankedEntry[]; isElim: boolean; meId: string | null; championId: string | null }) {
  if (leaderboard.length === 0) return null;
  const rows = championId
    ? [...leaderboard].sort((a, b) => Number(b.participantId === championId) - Number(a.participantId === championId))
    : leaderboard;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
      <FinalHeading />
      <div className="flex max-h-[62vh] w-full flex-col gap-2.5 overflow-y-auto px-0.5 pb-1">
        {rows.map((e, i) => {
          const out = e.status === 'ELIMINATED';
          const champ = championId ? e.participantId === championId : e.rank === 1 && !out;
          return (
            <LeaderRow
              key={e.participantId}
              rank={i + 1}
              name={e.nickname + (e.participantId === meId ? ` (${t(L, 'you')})` : '')}
              color={champ ? '#F6A41C' : avatarColor(e.avatarId)}
              avatar={<Avatar avatarId={e.avatarId} size={36} shape="square" />}
              highlight={champ || e.participantId === meId}
              dimmed={out}
              value={isElim ? (out ? <Skull size={16} /> : <Hearts lives={e.lives} size={14} />) : (champ ? <CountUp value={e.score} /> : e.score)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────── Teams ──────────────────────────────────────

function TeamResult({
  teams, leaderboard, winnerTeam, myTeamId, championId,
}: {
  teams: TeamPublic[];
  leaderboard: RankedEntry[];
  winnerTeam: TeamPublic | null;
  myTeamId: string | null;
  championId: string | null;
}) {
  const all = teams.length > 0 ? teams : winnerTeam ? [winnerTeam] : [];
  const ranked = [...all].sort(
    (a, b) => Number(b.id === championId) - Number(a.id === championId) || b.score - a.score,
  );
  if (ranked.length === 0) return null;
  const membersOf = (teamId: string) => leaderboard.filter((e) => e.teamId === teamId);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
      <FinalHeading />
      <div className="flex max-h-[62vh] w-full flex-col gap-3 overflow-y-auto px-0.5 pb-1">
        {ranked.map((team, i) => {
          const champ = championId ? team.id === championId : i === 0;
          const mine = team.id === myTeamId;
          const members = membersOf(team.id);
          return (
            <div
              key={team.id}
              className={`flex flex-col gap-2 rounded-3xl p-3 text-white shadow-[0_14px_26px_-12px_rgba(0,0,0,0.45),inset_0_2px_1px_rgba(255,255,255,0.3)] ${champ ? 'ring-4 ring-[#F6C43E]' : mine ? 'ring-2 ring-white/70' : ''}`}
              style={{ background: `linear-gradient(180deg, ${team.color}cc, ${team.color})` }}
            >
              <div className="flex items-center gap-3">
                <span className="tnum w-7 text-center font-display text-lg font-black">{i + 1}</span>
                {champ && <Crown size={22} className="shrink-0 text-[#FFE9A8]" />}
                <span className="min-w-0 flex-1 truncate font-display text-xl font-black">
                  {team.name}{mine && <span className="text-sm font-bold text-white/80"> ({t(L, 'you')})</span>}
                </span>
                <span className="tnum font-display text-2xl font-black">
                  {champ ? <CountUp value={team.score} /> : team.score}
                </span>
              </div>
              {members.length > 0 && (
                <div className="flex flex-wrap gap-x-3 ps-10 text-sm font-bold text-white/85">
                  {members.map((m) => (
                    <span key={m.participantId} className="truncate">{m.nickname}</span>
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

function FinalHeading() {
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div animate={{ y: [0, -8, 0], rotate: [-3, 3, -3] }} transition={{ duration: 3, repeat: Infinity }}>
        <Trophy size={64} className="text-[#F6C43E]" style={{ filter: 'drop-shadow(0 0 24px rgba(246,196,62,0.8))' }} />
      </motion.div>
      <GoldHeading className="text-4xl">{t(L, 'finalRanking')}</GoldHeading>
    </div>
  );
}
