import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Crown, Skull, Trophy } from 'lucide-react';
import { GameType, GameMode, type RankedEntry } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';
import { Hearts } from '../components/Hearts.js';

// Results are presented in English to match the big screen (client request).
const L = 'en' as const;
const MEDALS = ['🥇', '🥈', '🥉'];
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

export function Finished() {
  const { winner, participantId, myRank, gameType, gameMode, myTeamId, teams } = useStore();
  const isTeams = gameType === GameType.TEAMS;
  const isElim = gameMode === GameMode.ELIMINATION;
  const iWon = isTeams
    ? !!winner?.winnerTeam && myTeamId === winner.winnerTeam.id
    : winner?.winner?.id === participantId;

  const board = winner?.finalLeaderboard ?? [];
  const teamRanked = [...(winner?.teams ?? teams)].sort((a, b) => b.score - a.score);
  const myTeam = teamRanked.find((tm) => tm.id === myTeamId);

  return (
    <div className="relative flex min-h-dvh flex-col items-center px-5 pb-10 pt-8">
      {iWon && <Confetti />}

      {/* ── Personalized banner ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 170, damping: 15 }}
        className="relative z-10 flex flex-col items-center gap-1.5 text-center"
      >
        {iWon ? (
          <>
            <motion.div animate={{ y: [0, -7, 0], rotate: [-4, 4, -4] }} transition={{ duration: 2.6, repeat: Infinity }}>
              <Trophy size={64} className="text-prize-gold" style={{ filter: 'drop-shadow(0 0 22px rgba(245,197,24,0.85))' }} />
            </motion.div>
            <p className="font-display text-4xl font-black text-gold-gradient">You won!</p>
            <p className="font-display text-base font-bold text-ink-secondary">{t(L, 'champion')}</p>
            {isTeams && myTeam && (
              <p className="font-display text-2xl font-extrabold" style={{ color: myTeam.color }}>{myTeam.name}</p>
            )}
          </>
        ) : (
          <>
            <Crown size={44} className="text-ink-muted" />
            <p className="font-display text-3xl font-black">{t(L, 'gameOver')}</p>
            {!isTeams && myRank > 0 && (
              <div className="mt-0.5 flex items-center gap-2">
                {myRank <= 3 && <span className="text-2xl">{MEDALS[myRank - 1]}</span>}
                <p className="font-display text-lg text-ink-secondary">
                  You finished <b className="tnum text-ink-primary">#{myRank}</b>
                </p>
              </div>
            )}
            {isTeams && myTeam && (
              <p className="font-display text-lg font-bold" style={{ color: myTeam.color }}>{myTeam.name}</p>
            )}
          </>
        )}
      </motion.div>

      {/* ── Podium (individual, top 3) ── */}
      {!isTeams && board.length > 0 && <PhonePodium top3={board.slice(0, 3)} isElim={isElim} meId={participantId} />}

      {/* ── Final ranking ── */}
      <div className="relative z-10 mt-6 w-full max-w-sm">
        <p className="mb-3 text-center font-display text-base font-black text-gradient">{t(L, 'finalRanking')}</p>
        <div className="space-y-2">
          {isTeams
            ? teamRanked.map((team, i) => {
                const mine = team.id === myTeamId;
                return (
                  <Row key={team.id} index={i} highlight={mine} gold={i === 0}>
                    <Rank rank={i + 1} />
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: team.color }}>
                      {i === 0 ? <Crown size={18} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-display text-sm font-extrabold" style={{ color: team.color }}>
                      {team.name}
                      {mine && <span className="ms-1.5 text-xs font-bold text-ink-muted">({t(L, 'you')})</span>}
                    </span>
                    <span className="tnum font-display text-sm font-black">{team.score}</span>
                  </Row>
                );
              })
            : board.map((e: RankedEntry, i) => {
                const mine = e.participantId === participantId;
                const out = e.status === 'ELIMINATED';
                return (
                  <Row key={e.participantId} index={i} highlight={mine} gold={i === 0} dim={out && !isElim}>
                    <Rank rank={e.rank} />
                    <Avatar avatarId={e.avatarId} size={30} />
                    <span className="min-w-0 flex-1 truncate font-display text-sm font-bold" dir="auto">
                      {e.nickname}
                      {mine && <span className="ms-1.5 text-xs font-bold text-ink-muted">({t(L, 'you')})</span>}
                    </span>
                    {isElim ? (
                      out ? <Skull size={20} className="shrink-0 text-danger" /> : <Hearts lives={e.lives} size={15} />
                    ) : (
                      <span className="tnum font-display text-sm font-black">{e.score}</span>
                    )}
                  </Row>
                );
              })}
        </div>
      </div>
    </div>
  );
}

/** Compact 2nd–1st–3rd podium for the phone. */
function PhonePodium({ top3, isElim, meId }: { top3: RankedEntry[]; isElim: boolean; meId: string | null }) {
  const [first, second, third] = top3;
  const slots = [
    second && { e: second, place: 2 as const },
    first && { e: first, place: 1 as const },
    third && { e: third, place: 3 as const },
  ].filter(Boolean) as { e: RankedEntry; place: 1 | 2 | 3 }[];

  const cfg = {
    1: { ped: 'h-20', face: 'linear-gradient(180deg,#FDE68A,#F59E0B)', ring: 'ring-2 ring-prize-gold', av: 60, rise: 0.4 },
    2: { ped: 'h-14', face: 'linear-gradient(180deg,#E5E7EB,#9CA3AF)', ring: 'ring-1 ring-ink-muted/30', av: 46, rise: 0.18 },
    3: { ped: 'h-11', face: 'linear-gradient(180deg,#FCD9B6,#C2772F)', ring: 'ring-1 ring-ink-muted/30', av: 42, rise: 0.28 },
  } as const;

  return (
    <div className="relative z-10 mt-7 flex w-full max-w-sm items-end justify-center gap-2.5">
      {slots.map(({ e, place }) => {
        const c = cfg[place];
        const champ = place === 1;
        const mine = e.participantId === meId;
        return (
          <div key={e.participantId} className="flex flex-1 flex-col items-center justify-end">
            {champ && (
              <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }} transition={{ opacity: { delay: 0.5 }, scale: { delay: 0.5, type: 'spring', stiffness: 200 }, y: { duration: 2.4, repeat: Infinity } }}>
                <Crown size={26} className="text-prize-gold" style={{ filter: 'drop-shadow(0 0 12px rgba(245,197,24,0.9))' }} />
              </motion.div>
            )}
            <motion.div
              initial={{ opacity: 0, scale: 0.4, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: c.rise + 0.2, type: 'spring', stiffness: 220, damping: 16 }}
              className={`rounded-full ${c.ring}`}
            >
              <Avatar avatarId={e.avatarId} size={c.av} />
            </motion.div>
            <span className={`mt-1.5 max-w-full truncate font-display text-xs font-black ${champ ? 'text-gold-gradient' : ''}`} dir="auto">
              {e.nickname}{mine && ' *'}
            </span>
            {isElim ? (
              <Hearts lives={e.lives} size={12} />
            ) : (
              <span className="tnum font-display text-xs font-bold text-ink-secondary">{e.score}</span>
            )}
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: c.rise, type: 'spring', stiffness: 120, damping: 18 }}
              style={{ transformOrigin: 'bottom', backgroundImage: c.face }}
              className={`mt-2 grid w-full place-items-center rounded-t-xl shadow-card ${c.ped}`}
            >
              <span className="font-display text-2xl font-black text-white/90" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>{place}</span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

function Row({
  children, index, highlight, gold, dim,
}: {
  children: ReactNode;
  index: number;
  highlight?: boolean;
  gold?: boolean;
  dim?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(0.5 + index * 0.05, 0.9) }}
      className={[
        'flex items-center gap-2.5 rounded-xl px-3 py-2.5',
        highlight ? 'bg-brand-deep/15 ring-2 ring-brand-deep/50' : gold ? 'bg-prize-gold/10 ring-1 ring-prize-gold/50' : 'bg-bg-raised/60',
        dim ? 'opacity-55' : '',
      ].join(' ')}
    >
      {children}
    </motion.div>
  );
}

function Rank({ rank }: { rank: number }) {
  if (rank <= 3) return <span className="w-6 text-center text-xl">{MEDALS[rank - 1]}</span>;
  return <span className="tnum w-6 text-center font-display text-base font-black text-ink-secondary">{rank}</span>;
}
