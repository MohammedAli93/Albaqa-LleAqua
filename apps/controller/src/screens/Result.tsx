import { motion } from 'framer-motion';
import { Check, X, Clock, Zap, ChevronRight } from 'lucide-react';
import { GameType, GameMode } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Hearts } from '../components/Hearts.js';
import { Avatar } from '../components/Avatar.js';

/** Shown after personal result arrives, or while waiting for results (locked). */
export function Result() {
  const {
    phase, lastResult, myLives, locale, gameType, gameMode, lastHeroes, myTeamId, teams,
    leaderboard, participantId, totalRounds, nextRound, nextCategory,
  } = useStore();
  const isTeams = gameType === GameType.TEAMS;
  const isElimination = gameMode === GameMode.ELIMINATION;

  if (phase === 'locked') {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5">
          <Clock size={72} className="text-brand-cyan animate-pulse-glow" />
          <p className="font-display text-3xl font-bold">{t(locale, 'answerLocked')}</p>
          <p className="text-ink-secondary">{t(locale, 'waitingForResults')}</p>
        </motion.div>
      </div>
    );
  }

  const correct = lastResult?.isCorrect;
  // Standings to show on the phone after each question. Teams' totals live on the
  // big screen, so the per-player table is for individual modes (points/elimination).
  const showStandings = !isTeams && leaderboard.length > 0;
  return (
    <div
      className="flex min-h-dvh flex-col items-center px-5 pb-8 pt-8"
      style={{ background: correct ? 'radial-gradient(ellipse at 50% 0%, rgba(34,197,94,0.22), transparent 55%)' : 'radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.2), transparent 55%)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 16 }}
        className="flex flex-col items-center gap-3"
      >
        <div className={`grid h-20 w-20 place-items-center rounded-full ${correct ? 'bg-success' : 'bg-danger'}`} style={{ boxShadow: `0 0 40px ${correct ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.5)'}` }}>
          {correct ? <Check size={48} color="white" /> : <X size={48} color="white" />}
        </div>
        <p className="font-display text-3xl font-black">{correct ? t(locale, 'correct') : t(locale, 'wrong')}</p>

        {/* Individual POINTS only: the personal points gained this round. */}
        {!isTeams && !isElimination && lastResult && lastResult.pointsAwarded > 0 && (
          <p className="tnum font-display text-2xl font-bold text-success">+{lastResult.pointsAwarded}</p>
        )}

        {/* Teams: which team took the point this round, and who was fastest —
            shown to EVERYONE so the team scoring is clear in points mode. */}
        {isTeams && lastHeroes.length > 0 && (
          <div className="flex w-full max-w-sm flex-col gap-2">
            {lastHeroes.map((h) => {
              const mine = h.teamId === myTeamId;
              const color = teams.find((tm) => tm.id === h.teamId)?.color ?? '#4F46E5';
              return (
                <div
                  key={h.teamId}
                  className={['flex items-center gap-3 rounded-2xl px-4 py-3 text-start', mine ? 'ring-2' : 'bg-bg-raised/60'].join(' ')}
                  style={mine ? { background: `${color}22`, ['--tw-ring-color' as string]: color } : { borderInlineStart: `5px solid ${color}` }}
                >
                  <Zap size={22} className="shrink-0 text-prize-gold" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-base font-black" style={{ color }}>
                      {t(locale, 'teamTookPoint', { team: h.teamName })}
                    </span>
                    <span className="block truncate text-sm text-ink-secondary" dir="auto">
                      {t(locale, 'answeredFirst', { name: h.nickname })}
                    </span>
                  </span>
                  <span className="tnum font-display text-lg font-black text-success">+{h.pointsAwarded}</span>
                </div>
              );
            })}
          </div>
        )}

        {isElimination && <Hearts lives={myLives} size={28} />}
      </motion.div>

      {/* Live standings after each question. */}
      {showStandings && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mt-6 w-full max-w-sm"
        >
          <p className="mb-2 px-1 font-display text-sm font-bold text-ink-secondary">{t(locale, 'standings')}</p>
          <div className="space-y-1.5">
            {standingsToShow(leaderboard, participantId).map((e) => {
              const mine = e.participantId === participantId;
              const out = e.status === 'ELIMINATED';
              return (
                <div
                  key={e.participantId}
                  className={[
                    'flex items-center gap-2.5 rounded-xl px-3 py-2',
                    mine ? 'bg-brand-deep/15 ring-1 ring-brand-deep/40' : 'bg-bg-raised/60',
                    out ? 'opacity-50' : '',
                  ].join(' ')}
                >
                  <span className="tnum w-6 text-center font-display text-base font-black text-ink-secondary">{e.rank}</span>
                  <Avatar avatarId={e.avatarId} size={28} />
                  <span className="min-w-0 flex-1 truncate font-display text-sm font-bold" dir="auto">{e.nickname}</span>
                  {isElimination ? (
                    <Hearts lives={e.lives} size={16} />
                  ) : (
                    <span className="tnum font-display text-sm font-black">{e.score}</span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Next question preview — number of N, and the upcoming category. */}
      {nextRound && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 flex w-full max-w-sm items-center gap-3 rounded-2xl bg-bg-raised/70 px-4 py-3"
        >
          {nextCategory && (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: nextCategory.color }}>
              <ChevronRight size={20} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-display text-xs font-bold uppercase tracking-wide text-ink-secondary">{t(locale, 'nextUp')}</span>
            <span className="block truncate font-display text-base font-black">
              {t(locale, 'questionOf', { current: nextRound, total: totalRounds })}
              {nextCategory ? ` · ${nextCategory.nameAr}` : ''}
            </span>
          </span>
        </motion.div>
      )}
    </div>
  );
}

/** Top entries plus the player's own row if they're outside the top slice. */
function standingsToShow(board: ReturnType<typeof useStore.getState>['leaderboard'], selfId: string | null) {
  const top = board.slice(0, 5);
  if (selfId && !top.some((e) => e.participantId === selfId)) {
    const me = board.find((e) => e.participantId === selfId);
    if (me) return [...top, me];
  }
  return top;
}
