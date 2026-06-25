import { motion, AnimatePresence } from 'framer-motion';
import { Skull } from 'lucide-react';
import { GameMode } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';
import { Hearts } from '../components/Hearts.js';
import { HostBg } from '../components/HostBg.js';
import { GoldTitle, LeaderRow, avatarColor } from '../components/desert.js';

const TEAM_CARD = 'linear-gradient(180deg,#FCEE5F 0%,#F8DE34 46%,#F3CC13 100%)';

export function Scoreboard() {
  const { leaderboard, eliminatedThisRound, teams, mode, locale } = useStore();

  if (teams.length > 0) return <TeamBoard />;

  const isElimination = mode === GameMode.ELIMINATION;
  const eliminated = new Set(eliminatedThisRound);
  return (
    <div className="safe relative flex min-h-dvh flex-col overflow-hidden lg:h-full">
      <HostBg variant="sky" />
      <GoldTitle className="relative z-10 mb-5 text-screen-title lg:mb-8">{t(locale, 'leaderboard')}</GoldTitle>
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col gap-2.5 lg:gap-3.5 lg:overflow-hidden">
        <AnimatePresence>
          {leaderboard.map((e) => {
            const isOut = eliminated.has(e.participantId) || e.status === 'ELIMINATED';
            const isLeader = e.rank === 1 && !isOut;
            return (
              <LeaderRow
                key={e.participantId}
                rank={e.rank}
                name={e.nickname}
                color={avatarColor(e.avatarId)}
                avatar={<Avatar avatarId={e.avatarId} size={52} shape="square" />}
                highlight={isLeader}
                dimmed={isOut}
                value={
                  isElimination
                    ? (isOut ? <Skull size={22} /> : <Hearts lives={e.lives} size={22} />)
                    : e.score
                }
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Team-vs-team standings on the warm sand plate (reference screen 20). */
function TeamBoard() {
  const { teams, leaderboard, locale } = useStore();
  const ranked = [...teams].sort((a, b) => b.score - a.score);

  return (
    <div className="safe relative flex min-h-dvh flex-col overflow-hidden lg:h-full">
      <HostBg variant="team" />
      <h2
        className="relative z-10 mb-5 text-center font-display text-screen-title font-black text-desert-ink lg:mb-8"
        style={{ filter: 'drop-shadow(0 3px 10px rgba(255,255,255,0.5))' }}
      >
        {t(locale, 'leaderboard')}
      </h2>
      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 auto-cols-fr grid-flow-row gap-4 lg:grid-flow-col lg:gap-6">
        {ranked.map((team, idx) => {
          const members = leaderboard.filter((e) => e.teamId === team.id);
          const isLeader = idx === 0;
          return (
            <motion.div
              key={team.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              className={`flex flex-col overflow-hidden rounded-[1.75rem] shadow-[0_30px_70px_-34px_rgba(120,70,10,0.7)] ring-1 ring-white/50 ${
                isLeader ? 'ring-4 ring-[#FFE9A8]' : ''
              }`}
              style={{ backgroundImage: TEAM_CARD }}
            >
              <div className="flex flex-col items-end gap-1 px-6 py-5 lg:px-8 lg:py-6" style={{ background: 'linear-gradient(180deg,#FFD93A 0%,#F6C81E 100%)' }}>
                <span className="max-w-full truncate font-display text-screen-team font-black" style={{ color: team.color }}>
                  {team.name}
                </span>
                <span className="tnum font-display font-black leading-none text-desert-night text-[clamp(2.75rem,5.5vw,5.5rem)]">
                  {team.score}
                </span>
                <span className="font-display text-screen-status font-black text-desert-ink/80">{t(locale, 'points')}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4 lg:overflow-hidden lg:p-5">
                <AnimatePresence>
                  {members.map((m) => (
                    <motion.div
                      key={m.participantId}
                      layout
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 rounded-2xl bg-white/85 px-3.5 py-2.5 shadow-sm"
                    >
                      <Avatar avatarId={m.avatarId} size={42} shape="square" />
                      <span className="flex-1 truncate font-display text-screen-rankname font-bold text-desert-ink">{m.nickname}</span>
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
