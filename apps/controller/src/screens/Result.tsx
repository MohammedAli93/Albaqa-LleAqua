import { motion } from 'framer-motion';
import { Check, X, Timer, Zap, Play } from 'lucide-react';
import { GameType, GameMode } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Hearts } from '../components/Hearts.js';
import { Avatar } from '../components/Avatar.js';
import {
  GameShell, CenterStage, YellowCard, Pill, Squircle, LeaderRow, avatarColor,
} from '../components/desert.js';

/** Shown after personal result arrives, or while waiting for results (locked). */
export function Result() {
  const {
    phase, lastResult, myLives, locale, gameType, gameMode, lastHeroes, myTeamId, teams,
    leaderboard, participantId, totalRounds, nextRound, nextCategory,
  } = useStore();
  const isTeams = gameType === GameType.TEAMS;
  const isElimination = gameMode === GameMode.ELIMINATION;

  // ── Locked: answer recorded, waiting for the reveal (reference screen 17) ──
  if (phase === 'locked') {
    return (
      <GameShell>
        <CenterStage>
          <YellowCard className="text-center">
            <div className="flex flex-col items-center gap-5">
              <Squircle size={92}><Timer size={46} strokeWidth={2.4} /></Squircle>
              <p className="font-display text-3xl font-black text-desert-ink">{t(locale, 'answerLocked')}</p>
              <Pill color="red" className="px-7 py-2.5 text-base">{t(locale, 'waitingForResults')}</Pill>
            </div>
          </YellowCard>
        </CenterStage>
      </GameShell>
    );
  }

  const correct = lastResult?.isCorrect;
  // Per-player standings on the phone (team totals live on the big screen).
  const showStandings = !isTeams && leaderboard.length > 0;

  return (
    <GameShell>
      <CenterStage className="items-start py-6">
        <YellowCard className="text-center">
          <div className="flex flex-col items-center gap-4">
            <Squircle size={86} bg={correct ? 'linear-gradient(160deg,#39D98A 0%,#15BC85 100%)' : undefined}>
              {correct ? <Check size={44} strokeWidth={3} /> : <X size={44} strokeWidth={3} />}
            </Squircle>
            <p className="font-display text-3xl font-black text-desert-ink">
              {correct ? t(locale, 'correct') : t(locale, 'wrong')}
            </p>

            {/* Individual POINTS: personal points gained this round. */}
            {!isTeams && !isElimination && lastResult && lastResult.pointsAwarded > 0 && (
              <Pill color="green" className="text-base">+{lastResult.pointsAwarded}</Pill>
            )}

            {isElimination && <Hearts lives={myLives} size={28} />}

            {/* Teams: which team took the point this round + who was fastest. */}
            {isTeams && lastHeroes.length > 0 && (
              <div className="flex w-full flex-col gap-2">
                {lastHeroes.map((h) => {
                  const color = teams.find((tm) => tm.id === h.teamId)?.color ?? '#5BA8F5';
                  return (
                    <div
                      key={h.teamId}
                      className="flex items-center gap-3 rounded-full px-4 py-2.5 text-start text-white shadow-[inset_0_2px_1px_rgba(255,255,255,0.3)]"
                      style={{ background: `linear-gradient(180deg, ${color}cc, ${color})`, ...(h.teamId === myTeamId ? { boxShadow: '0 0 0 4px rgba(255,255,255,0.7)' } : {}) }}
                    >
                      <Zap size={20} className="shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-sm font-black">
                          {t(locale, 'teamTookPoint', { team: h.teamName })}
                        </span>
                        <span className="block truncate font-display text-xs font-bold text-white/80" dir="auto">
                          {t(locale, 'answeredFirst', { name: h.nickname })}
                        </span>
                      </span>
                      <span className="tnum font-display text-lg font-black">+{h.pointsAwarded}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Live standings (reference screen 18 — "الترتيب"). */}
            {showStandings && (
              <div className="mt-2 w-full">
                <p className="mb-2 font-display text-sm font-black text-desert-ink/80">{t(locale, 'standings')}</p>
                <div className="flex flex-col gap-2">
                  {standingsToShow(leaderboard, participantId).map((e) => (
                    <LeaderRow
                      key={e.participantId}
                      rank={e.rank}
                      name={e.nickname}
                      color={avatarColor(e.avatarId)}
                      avatar={<Avatar avatarId={e.avatarId} size={34} shape="square" />}
                      highlight={e.participantId === participantId}
                      dimmed={e.status === 'ELIMINATED'}
                      value={isElimination ? <Hearts lives={e.lives} size={14} /> : e.score}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Next-question preview (cream row). */}
            {nextRound && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-[#FBF1CE] px-4 py-3 text-start shadow-[inset_0_2px_3px_rgba(180,120,20,0.18)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-xs font-black text-desert-ink/70">{t(locale, 'nextUp')}</span>
                  <span className="block truncate font-display text-base font-black text-desert-ink">
                    {isElimination
                      ? t(locale, 'roundNum', { current: nextRound })
                      : t(locale, 'questionOf', { current: nextRound, total: totalRounds })}
                    {nextCategory ? ` – ${nextCategory.nameAr}` : ''}
                  </span>
                </span>
                <Squircle size={42}><Play size={20} className="ms-0.5" fill="currentColor" /></Squircle>
              </motion.div>
            )}
          </div>
        </YellowCard>
      </CenterStage>
    </GameShell>
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
