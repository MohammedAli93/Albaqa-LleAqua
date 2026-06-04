import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Skull } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';

export function Scoreboard() {
  const { leaderboard, eliminatedThisRound, locale } = useStore();
  const eliminated = new Set(eliminatedThisRound);

  return (
    <div className="safe flex h-full flex-col">
      <h2 className="mb-8 text-center font-display text-5xl font-black text-gradient">
        {t(locale, 'leaderboard')}
      </h2>
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-3 overflow-hidden">
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
                className={`glass-strong flex items-center gap-4 rounded-xl2 p-4 ${
                  isLeader ? 'ring-2 ring-prize-gold shadow-gold' : ''
                }`}
              >
                <span className={`tnum w-12 text-center font-display text-4xl font-black ${isLeader ? 'text-gold-gradient' : 'text-ink-secondary'}`}>
                  {e.rank}
                </span>
                <Avatar avatarId={e.avatarId} size={52} />
                <span className="flex-1 truncate font-display text-2xl font-semibold">{e.nickname}</span>
                {isOut ? (
                  <Skull className="text-danger" />
                ) : isLeader ? (
                  <Crown className="text-prize-gold" />
                ) : null}
                <div className="flex items-baseline gap-2">
                  <span className="tnum font-display text-3xl font-bold">{e.score}</span>
                  {e.delta > 0 && (
                    <motion.span
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="tnum text-lg font-bold text-success"
                    >
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
