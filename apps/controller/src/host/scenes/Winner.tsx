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

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * End-game showcase — a celebratory 1st/2nd/3rd PODIUM as the hero, confetti, a
 * spotlight on the champion, then the rest of the field. Three variants: individual
 * points, individual elimination, teams.
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
      {/* spotlight + glows behind the podium */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-10%] h-[60vh] w-[70vw] -translate-x-1/2 rounded-full bg-white/20 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-[-10%] left-1/2 h-[40vh] w-[80vw] -translate-x-1/2 rounded-full bg-prize-gold/20 blur-[120px]" />
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

function PlayerResult({ leaderboard, isElim }: { leaderboard: RankedEntry[]; isElim: boolean }) {
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  if (top3.length === 0) return null;

  return (
    <div className="relative z-10 flex w-full max-w-5xl flex-col items-center">
      <Headline title={t(L, 'champion')} />
      <Podium top3={top3} isElim={isElim} />

      {rest.length > 0 && (
        <div className="mt-7 w-full max-w-2xl lg:mt-9">
          <div className="flex flex-col gap-2.5 lg:gap-3">
            {rest.map((e, i) => {
              const out = e.status === 'ELIMINATED';
              return (
                <motion.div
                  key={e.participantId}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(0.7 + i * 0.06, 1.2) }}
                  className="glass flex items-center gap-3 rounded-xl2 p-3 lg:gap-4 lg:p-4"
                >
                  <span className="tnum w-9 text-center font-display text-screen-ranknum font-black text-ink-muted">{e.rank}</span>
                  <Avatar avatarId={e.avatarId} size={48} />
                  <span className="min-w-0 flex-1 truncate font-display text-screen-rankname font-bold">{e.nickname}</span>
                  {isElim ? (
                    out ? <Skull className="shrink-0 text-danger" size={26} /> : <Hearts lives={e.lives} size={24} />
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

/** The 2nd–1st–3rd podium. Pedestal heights differ, so the champion stands tallest. */
function Podium({ top3, isElim }: { top3: RankedEntry[]; isElim: boolean }) {
  const [first, second, third] = top3;
  const slots = [
    second && { e: second, place: 2 as const },
    first && { e: first, place: 1 as const },
    third && { e: third, place: 3 as const },
  ].filter(Boolean) as { e: RankedEntry; place: 1 | 2 | 3 }[];

  // Per-place styling. 1st = tall + gold, 2nd silver, 3rd bronze.
  const cfg = {
    1: { ped: 'h-40 lg:h-60', face: 'linear-gradient(180deg,#FDE68A 0%,#F59E0B 100%)', ring: 'ring-2 ring-prize-gold shadow-gold', av: 112, rise: 0.45 },
    2: { ped: 'h-28 lg:h-44', face: 'linear-gradient(180deg,#E5E7EB 0%,#9CA3AF 100%)', ring: 'ring-1 ring-white/60', av: 84, rise: 0.2 },
    3: { ped: 'h-24 lg:h-36', face: 'linear-gradient(180deg,#FCD9B6 0%,#C2772F 100%)', ring: 'ring-1 ring-white/50', av: 76, rise: 0.3 },
  } as const;

  return (
    <div className="flex w-full max-w-3xl items-end justify-center gap-3 lg:gap-6">
      {slots.map(({ e, place }) => {
        const c = cfg[place];
        const isChamp = place === 1;
        return (
          <div key={e.participantId} className="flex flex-1 flex-col items-center justify-end">
            {/* crown over the champion */}
            {isChamp && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.5 }}
                animate={{ opacity: 1, y: [0, -8, 0], scale: 1, rotate: [-4, 4, -4] }}
                transition={{ opacity: { delay: 0.6 }, scale: { delay: 0.6, type: 'spring', stiffness: 200 }, y: { duration: 2.4, repeat: Infinity }, rotate: { duration: 2.4, repeat: Infinity } }}
              >
                <Crown className="h-9 w-9 text-prize-gold lg:h-14 lg:w-14" style={{ filter: 'drop-shadow(0 0 18px rgba(245,197,24,0.9))' }} />
              </motion.div>
            )}

            {/* avatar pops up after its pedestal rises */}
            <motion.div
              initial={{ opacity: 0, scale: 0.4, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: c.rise + 0.25, type: 'spring', stiffness: 220, damping: 16 }}
              className={`relative grid place-items-center rounded-full ${c.ring}`}
            >
              <Avatar avatarId={e.avatarId} size={c.av} />
            </motion.div>

            {/* name + metric */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: c.rise + 0.45 }}
              className="mt-2 flex flex-col items-center gap-0.5 text-center"
            >
              <span className={`max-w-[8rem] truncate font-display font-black lg:max-w-[12rem] ${isChamp ? 'text-screen-name text-gold-gradient' : 'text-screen-rankname text-white drop-shadow'}`}>
                {e.nickname}
              </span>
              {isElim ? (
                <Hearts lives={e.lives} size={isChamp ? 30 : 22} />
              ) : (
                <span className="tnum font-display text-screen-score font-black text-white drop-shadow">
                  {isChamp ? <CountUp value={e.score} /> : e.score} <span className="text-screen-meta font-semibold text-white/70">{t(L, 'points')}</span>
                </span>
              )}
            </motion.div>

            {/* pedestal grows from the floor */}
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: c.rise, type: 'spring', stiffness: 120, damping: 18 }}
              style={{ transformOrigin: 'bottom', backgroundImage: c.face }}
              className={`mt-3 grid w-full place-items-center rounded-t-2xl shadow-card ${c.ped}`}
            >
              <span className="font-display text-5xl font-black text-white/90 drop-shadow lg:text-7xl" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                {place}
              </span>
            </motion.div>
          </div>
        );
      })}
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
        <Trophy className="h-[1.05em] w-[1.05em] text-screen-champion text-prize-gold" style={{ filter: 'drop-shadow(0 0 36px rgba(245,197,24,0.9))' }} />
      </motion.div>
      <h1 className="font-display text-screen-champion font-black text-gold-gradient" style={{ filter: 'drop-shadow(0 6px 30px rgba(245,158,11,0.35))' }}>
        {title}
      </h1>
    </motion.div>
  );
}

/** A team's contributing players, listed as name chips under the team tower. */
function MemberChips({ members }: { members: RankedEntry[] }) {
  if (members.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {members.map((m) => (
        <span key={m.participantId} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-display text-screen-meta font-semibold shadow-glass">
          <Avatar avatarId={m.avatarId} size={26} /> {m.nickname}
        </span>
      ))}
    </div>
  );
}

/**
 * Teams result: the winning team is the tall gold tower ("Champion" + score +
 * player names), the other team(s) the shorter "Better luck next time" tower(s).
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
  const champ = ranked[0];
  const losers = ranked.slice(1);
  if (!champ) return null;
  const membersOf = (teamId: string) => leaderboard.filter((e) => e.teamId === teamId);

  return (
    <div className="relative z-10 flex w-full max-w-5xl flex-col items-center">
      <Headline title={t(L, 'champion')} />

      {/* Towers: winner tall + gold, losers shorter */}
      <div className="flex w-full max-w-4xl items-end justify-center gap-4 lg:gap-8">
        {/* champion tower */}
        <TeamTower team={champ} members={membersOf(champ.id)} place={1} />
        {losers.map((team) => (
          <TeamTower key={team.id} team={team} members={membersOf(team.id)} place={2} />
        ))}
      </div>

      {losers.length > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 font-display text-screen-status font-bold text-white/85"
        >
          {t(L, 'betterLuck')}
        </motion.p>
      )}
    </div>
  );
}

function TeamTower({ team, members, place }: { team: TeamPublic; members: RankedEntry[]; place: 1 | 2 }) {
  const isChamp = place === 1;
  return (
    <div className={`flex flex-col items-center justify-end ${isChamp ? 'flex-[1.2]' : 'flex-1'}`}>
      {isChamp && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
          transition={{ opacity: { delay: 0.5 }, scale: { delay: 0.5, type: 'spring', stiffness: 200 }, y: { duration: 2.4, repeat: Infinity } }}
        >
          <Crown className="h-9 w-9 text-prize-gold lg:h-14 lg:w-14" style={{ filter: 'drop-shadow(0 0 18px rgba(245,197,24,0.9))' }} />
        </motion.div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: isChamp ? 0.45 : 0.3 }}
        className="flex flex-col items-center gap-1 text-center"
      >
        <h2 className={`max-w-full break-words font-display font-black ${isChamp ? 'text-screen-name' : 'text-screen-team'}`} style={{ color: team.color }}>
          {team.name}
        </h2>
        <p className="tnum font-display text-screen-score font-black text-white drop-shadow">
          {isChamp ? <CountUp value={team.score} /> : team.score} <span className="text-screen-meta font-semibold text-white/70">{t(L, 'points')}</span>
        </p>
      </motion.div>
      <MemberChips members={members} />
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: isChamp ? 0.45 : 0.25, type: 'spring', stiffness: 120, damping: 18 }}
        style={{ transformOrigin: 'bottom', borderTopColor: team.color }}
        className={`mt-4 w-full rounded-t-2xl border-t-8 ${isChamp ? 'h-32 shadow-gold ring-2 ring-prize-gold lg:h-44' : 'h-20 lg:h-28'}`}
      >
        <div className={`grid h-full w-full place-items-center rounded-t-xl ${isChamp ? 'bg-white/15' : 'bg-white/10'}`}>
          <span className="text-4xl lg:text-6xl">{place === 1 ? MEDALS[0] : MEDALS[1]}</span>
        </div>
      </motion.div>
    </div>
  );
}
