import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Skull, Trophy } from 'lucide-react';
import { GameType, GameMode } from '@tahaddi/shared';
import type { RankedEntry, TeamPublic } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';
import { Hearts } from '../components/Hearts.js';
import { ConfettiRain } from '../components/Confetti.js';

// The end-game showcase is always rendered in English (client request).
const L = 'en' as const;

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
 * End-game showcase. Everything is shown at once (no timed carousel that could hide
 * the standings): the champion is the oversized headline, the rest of the room is
 * laid out clearly beneath. Three variants — individual points, individual
 * elimination, and teams (winner + "better luck" losers).
 */
export function Winner() {
  const { winner, leaderboard, teams, type, mode } = useStore();
  if (!winner) return null;
  const isTeams = type === GameType.TEAMS;
  const isElim = mode === GameMode.ELIMINATION;

  return (
    <div
      className="safe relative grid min-h-dvh place-items-center overflow-y-auto overflow-x-hidden p-5 lg:h-full lg:p-8"
      style={{ backgroundImage: 'linear-gradient(165deg, #0284C7 0%, #0EA5E9 48%, #38BDF8 100%)' }}
    >
      <ConfettiRain />
      {isTeams ? (
        <TeamResult teams={teams} leaderboard={leaderboard} winnerTeam={winner.winnerTeam} />
      ) : (
        <PlayerResult leaderboard={leaderboard} isElim={isElim} />
      )}
    </div>
  );
}

// ─────────────────────────────── Individual ──────────────────────────────────

/**
 * Solo result: 1st place is the champion — a big, unmistakable hero. 2nd, 3rd,
 * 4th… follow in a clear ranked list. Points mode shows scores; elimination shows
 * hearts / a skull.
 */
function PlayerResult({ leaderboard, isElim }: { leaderboard: RankedEntry[]; isElim: boolean }) {
  const champ = leaderboard[0];
  const rest = leaderboard.slice(1);
  if (!champ) return null;

  return (
    <div className="grid w-full max-w-6xl items-center gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
      {/* Champion hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 150, damping: 18 }}
        className="flex flex-col items-center gap-3 text-center lg:gap-5"
      >
        <motion.div animate={{ y: [0, -12, 0], rotate: [-3, 3, -3] }} transition={{ duration: 3, repeat: Infinity }}>
          <Trophy className="h-[1.1em] w-[1.1em] text-screen-champion text-prize-gold" style={{ filter: 'drop-shadow(0 0 36px rgba(245,197,24,0.9))' }} />
        </motion.div>
        <h1 className="font-display text-screen-champion font-black text-gold-gradient" style={{ filter: 'drop-shadow(0 6px 30px rgba(245,158,11,0.35))' }}>
          {t(L, 'champion')}
        </h1>
        <div className="scale-110 lg:scale-[1.6]">
          <Avatar avatarId={champ.avatarId} size={120} />
        </div>
        <h2 className="max-w-full break-words font-display text-screen-name font-black text-gold-gradient">{champ.nickname}</h2>
        {isElim ? (
          <Hearts lives={champ.lives} size={48} />
        ) : (
          <p className="tnum font-display text-screen-score font-black text-white">
            <CountUp value={champ.score} /> {t(L, 'points')}
          </p>
        )}
        <p className="font-display text-screen-status font-bold text-white animate-pulse-glow">{t(L, 'congratulations')}</p>
      </motion.div>

      {/* The rest of the field */}
      {rest.length > 0 && (
        <div className="mx-auto flex w-full max-w-2xl flex-col">
          <h3 className="mb-4 text-center font-display text-screen-title font-black text-white drop-shadow lg:mb-6">{t(L, 'finalRanking')}</h3>
          <div className="flex flex-col gap-2.5 lg:gap-3">
            {rest.map((e, i) => {
              const out = e.status === 'ELIMINATED';
              return (
                <motion.div
                  key={e.participantId}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.06, 0.5) }}
                  className="glass flex items-center gap-3 rounded-xl2 p-3 lg:gap-4 lg:p-4"
                >
                  <RankBadge rank={e.rank} />
                  <Avatar avatarId={e.avatarId} size={52} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-display text-screen-rankname font-bold">{e.nickname}</span>
                    {isElim && <span className="font-display text-screen-meta text-ink-muted">{t(L, 'betterLuck')}</span>}
                  </div>
                  {isElim ? (
                    out ? <Skull className="shrink-0 text-danger" size={28} /> : <Hearts lives={e.lives} size={26} />
                  ) : (
                    <span className="tnum font-display text-screen-score font-black">
                      {e.score} <span className="text-screen-meta font-semibold text-ink-muted">{t(L, 'points')}</span>
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────── Teams ──────────────────────────────────────

/** A team's contributing players, listed as name chips under the team card. */
function MemberChips({ members }: { members: RankedEntry[] }) {
  if (members.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {members.map((m) => (
        <span key={m.participantId} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-display text-screen-meta font-semibold shadow-glass">
          <Avatar avatarId={m.avatarId} size={26} /> {m.nickname}
        </span>
      ))}
    </div>
  );
}

/**
 * Teams result: the winning team is the gold hero — "Champion" + team name + final
 * score, with its players named beneath. Every other team follows under a "Better
 * luck next time" banner, each with its own players named beneath.
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
  // Prefer the authoritative team table; fall back to the winner payload alone.
  const all = teams.length > 0 ? teams : winnerTeam ? [winnerTeam] : [];
  const ranked = [...all].sort((a, b) => b.score - a.score);
  const champ = ranked[0];
  const losers = ranked.slice(1);
  if (!champ) return null;
  const membersOf = (teamId: string) => leaderboard.filter((e) => e.teamId === teamId);

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-6 lg:gap-9">
      {/* Champion team */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 150, damping: 18 }}
        className="flex w-full max-w-3xl flex-col items-center gap-3 text-center lg:gap-4"
      >
        <motion.div animate={{ y: [0, -12, 0], rotate: [-3, 3, -3] }} transition={{ duration: 3, repeat: Infinity }}>
          <Trophy className="h-[1.1em] w-[1.1em] text-screen-champion text-prize-gold" style={{ filter: 'drop-shadow(0 0 36px rgba(245,197,24,0.9))' }} />
        </motion.div>
        <h1 className="font-display text-screen-champion font-black text-gold-gradient" style={{ filter: 'drop-shadow(0 6px 30px rgba(245,158,11,0.35))' }}>
          {t(L, 'champion')}
        </h1>
        <div className="glass-strong w-full rounded-xl3 p-5 shadow-gold ring-2 ring-prize-gold lg:p-7" style={{ borderTop: `8px solid ${champ.color}` }}>
          <div className="flex items-center justify-center gap-3 lg:gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full lg:h-20 lg:w-20" style={{ background: champ.color }}>
              <Crown color="white" className="h-7 w-7 lg:h-11 lg:w-11" />
            </div>
            <h2 className="max-w-full break-words font-display text-screen-name font-black" style={{ color: champ.color }}>{champ.name}</h2>
          </div>
          <p className="tnum mt-2 font-display text-screen-score font-black text-white">
            <CountUp value={champ.score} /> {t(L, 'points')}
          </p>
          <MemberChips members={membersOf(champ.id)} />
        </div>
        <p className="font-display text-screen-status font-bold text-white animate-pulse-glow">{t(L, 'congratulations')}</p>
      </motion.div>

      {/* Losing team(s) — "Better luck next time" */}
      {losers.length > 0 && (
        <div className="w-full">
          <h3 className="mb-4 text-center font-display text-screen-title font-black text-white/90 drop-shadow">{t(L, 'betterLuck')}</h3>
          <div className="mx-auto grid w-full max-w-4xl auto-cols-fr grid-flow-row gap-4 lg:grid-flow-col lg:gap-6">
            {losers.map((team, i) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.1 }}
                className="glass rounded-xl3 p-4 text-center lg:p-6"
                style={{ borderTop: `6px solid ${team.color}` }}
              >
                <div className="flex items-center justify-center gap-3">
                  <h2 className="max-w-full break-words font-display text-screen-team font-black" style={{ color: team.color }}>{team.name}</h2>
                </div>
                <p className="tnum mt-1 font-display text-screen-score font-black text-ink-secondary">
                  {team.score} <span className="text-screen-meta font-semibold text-ink-muted">{t(L, 'points')}</span>
                </p>
                <MemberChips members={membersOf(team.id)} />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
