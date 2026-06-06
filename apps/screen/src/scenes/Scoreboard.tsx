import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Skull, Heart } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';

export function Scoreboard() {
  const { leaderboard, eliminatedThisRound, teams, locale } = useStore();

  if (teams.length > 0) return <TeamBoard />;

  const eliminated = new Set(eliminatedThisRound);
  return (
    <div className="safe flex min-h-dvh flex-col lg:h-full">
      <h2 className="mb-5 text-center font-display text-3xl font-black text-gradient lg:mb-8 lg:text-5xl">
        {t(locale, 'leaderboard')}
      </h2>
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-2.5 lg:gap-3 lg:overflow-hidden">
        <AnimatePresence>
          {leaderboard.map((e) => {
            const isOut = eliminated.has(e.participantId) || e.status === 'ELIMINATED';
            const isLeader = e.rank === 1 && !isOut;
            return (
              <motion.div
                key={e.participantId}
                layout
                layoutId={e.participantId}
                initial={{ opacity: 0, y: 16 }}
                animate={{
                  opacity: isOut ? 0.35 : 1,
                  filter: isOut ? 'grayscale(1)' : 'none',
                  scale: isOut ? 0.96 : 1,
                }}
                transition={{ type: 'spring', stiffness: 240, damping: 26 }}
                className={`glass-strong flex items-center gap-3 rounded-xl2 p-3 lg:gap-4 lg:p-4 ${
                  isLeader ? 'ring-2 ring-prize-gold shadow-gold' : ''
                }`}
              >
                <span className={`tnum w-8 text-center font-display text-2xl font-black lg:w-12 lg:text-4xl ${isLeader ? 'text-gold-gradient' : 'text-ink-secondary'}`}>
                  {e.rank}
                </span>
                <Avatar avatarId={e.avatarId} size={44} />
                <span className="flex-1 truncate font-display text-lg font-semibold lg:text-2xl">{e.nickname}</span>
                {isOut ? <Skull className="shrink-0 text-danger" /> : isLeader ? <Crown className="shrink-0 text-prize-gold" /> : null}
                <div className="flex items-baseline gap-2">
                  <span className="tnum font-display text-2xl font-bold lg:text-3xl">{e.score}</span>
                  {e.delta > 0 && (
                    <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="tnum text-lg font-bold text-success">
                      +{e.delta}
                    </motion.span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Team-vs-team scoreboard: one card per team with total score, lives, members. */
function TeamBoard() {
  const { teams, leaderboard, mode, locale } = useStore();
  const ranked = [...teams].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(1, ...ranked.map((t) => t.score));
  const isElim = mode === 'ELIMINATION';

  return (
    <div className="safe flex min-h-dvh flex-col lg:h-full">
      <h2 className="mb-5 text-center font-display text-3xl font-black text-gradient lg:mb-8 lg:text-5xl">
        {t(locale, 'leaderboard')}
      </h2>
      <div className="mx-auto grid w-full max-w-6xl flex-1 auto-cols-fr grid-flow-row gap-4 lg:grid-flow-col lg:gap-6">
        {ranked.map((team, idx) => {
          const members = leaderboard.filter((e) => e.teamId === team.id);
          const isLeader = idx === 0;
          const dead = isElim && (team.lives ?? 1) <= 0;
          return (
            <motion.div
              key={team.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: dead ? 0.4 : 1, filter: dead ? 'grayscale(1)' : 'none' }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              className={`glass-strong flex flex-col rounded-xl3 p-4 lg:p-6 ${isLeader && !dead ? 'shadow-gold' : ''}`}
              style={{ borderTop: `6px solid ${team.color}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-display text-2xl font-black lg:text-3xl" style={{ color: team.color }}>
                  {team.name}
                </span>
                {isLeader && !dead && <Crown className="shrink-0 text-prize-gold" />}
                {dead && <Skull className="shrink-0 text-danger" />}
              </div>

              {/* big score + lives */}
              <div className="mt-2 flex items-end gap-3">
                <span className="tnum font-display text-4xl font-black lg:text-6xl">{team.score}</span>
                {isElim && (
                  <span className="mb-2 flex gap-1">
                    {Array.from({ length: Math.max(0, team.lives ?? 0) }).map((_, k) => (
                      <Heart key={k} size={22} className="fill-action text-action" />
                    ))}
                  </span>
                )}
              </div>

              {/* score bar */}
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-ink-muted/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: team.color }}
                  animate={{ width: `${(team.score / maxScore) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>

              {/* members */}
              <div className="mt-5 flex flex-1 flex-col gap-2 lg:overflow-hidden">
                <AnimatePresence>
                  {members
                    .sort((a, b) => b.score - a.score)
                    .map((m) => (
                      <motion.div
                        key={m.participantId}
                        layout
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 rounded-xl2 bg-white px-3 py-2 shadow-glass"
                      >
                        <Avatar avatarId={m.avatarId} size={36} />
                        <span className="flex-1 truncate text-lg font-semibold">{m.nickname}</span>
                        <span className="tnum text-lg text-ink-secondary">{m.score}</span>
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
