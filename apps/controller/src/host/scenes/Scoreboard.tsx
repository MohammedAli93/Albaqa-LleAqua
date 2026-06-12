import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Skull, Check } from 'lucide-react';
import { GameMode } from '@tahaddi/shared';
import type { RevealAnswerer } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import type { Locale } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';
import { Hearts } from '../components/Hearts.js';

const MEDALS = ['🥇', '🥈', '🥉'];

/** How long the correct-answer + 1st/2nd/3rd recap holds before the standings. */
const RECAP_MS = 3800;

/** Round chip shown between questions — solid fill so it's readable on the light stage. */
function RoundChip({ round, totalRounds, isElimination, locale }: { round: number; totalRounds: number; isElimination?: boolean; locale: Locale }) {
  if (round <= 0) return null;
  // ELIMINATION is open-ended (play to the last survivor) → no fixed total.
  if (!isElimination && totalRounds <= 0) return null;
  return (
    <span className="rounded-full bg-brand-deep px-5 py-1.5 font-display text-screen-meta font-black text-white shadow-glow">
      {isElimination
        ? t(locale, 'roundNum', { current: round })
        : t(locale, 'roundOf', { current: round, total: totalRounds })}
    </span>
  );
}

export function Scoreboard() {
  const { leaderboard, eliminatedThisRound, teams, mode, locale, question, correctOptionId, topAnswerers, round, totalRounds } = useStore();

  // Recap first: show the correct answer + who answered 1st/2nd/3rd, then slide to
  // the standings. (The next question's 3-2-1 follows the standings.)
  const hasRecap = !!correctOptionId && !!question;
  const [stage, setStage] = useState<'recap' | 'standings'>(hasRecap ? 'recap' : 'standings');
  useEffect(() => {
    if (stage !== 'recap') return;
    const id = window.setTimeout(() => setStage('standings'), RECAP_MS);
    return () => window.clearTimeout(id);
  }, [stage]);

  if (stage === 'recap' && hasRecap) {
    const correct = question!.options.find((o) => o.id === correctOptionId);
    return <Recap correctText={correct?.textAr ?? ''} answerers={topAnswerers} locale={locale} />;
  }

  if (teams.length > 0) return <TeamBoard />;

  const isElimination = mode === GameMode.ELIMINATION;
  const eliminated = new Set(eliminatedThisRound);
  return (
    <div className="safe flex min-h-dvh flex-col lg:h-full">
      <div className="mb-5 flex flex-col items-center gap-2.5 lg:mb-8">
        <RoundChip round={round} totalRounds={totalRounds} isElimination={isElimination} locale={locale} />
        <h2 className="text-center font-display text-screen-title font-black text-gradient">
          {t(locale, 'leaderboard')}
        </h2>
      </div>
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-2.5 lg:gap-3.5 lg:overflow-hidden">
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
                  opacity: isOut ? 0.4 : 1,
                  filter: isOut ? 'grayscale(1)' : 'none',
                  scale: isOut ? 0.97 : 1,
                }}
                transition={{ type: 'spring', stiffness: 240, damping: 26 }}
                className={`glass-strong flex items-center gap-3 rounded-xl2 p-3.5 lg:gap-5 lg:p-5 ${
                  isLeader ? 'ring-2 ring-prize-gold shadow-gold' : ''
                }`}
              >
                <span className={`tnum w-10 text-center font-display text-screen-ranknum font-black lg:w-16 ${isLeader ? 'text-gold-gradient' : 'text-ink-secondary'}`}>
                  {e.rank}
                </span>
                <Avatar avatarId={e.avatarId} size={56} />
                <span className="flex-1 truncate font-display text-screen-rankname font-bold">{e.nickname}</span>
                {isLeader && !isElimination ? <Crown className="shrink-0 text-prize-gold" size={32} /> : null}
                {isElimination ? (
                  // Survival mode: show hearts (or a skull when out), never a score.
                  isOut ? <Skull className="shrink-0 text-danger" size={32} /> : <Hearts lives={e.lives} size={30} />
                ) : (
                  <>
                    {isOut ? <Skull className="shrink-0 text-danger" size={32} /> : null}
                    <div className="flex items-baseline gap-2">
                      <span className="tnum font-display text-screen-score font-black">{e.score}</span>
                      {e.delta > 0 && (
                        <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="tnum font-display text-screen-meta font-bold text-success">
                          +{e.delta}
                        </motion.span>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Reveal recap: the correct answer, then the 1st / 2nd / 3rd fastest answerers. */
function Recap({ correctText, answerers, locale }: { correctText: string; answerers: RevealAnswerer[]; locale: Locale }) {
  return (
    <div className="safe grid min-h-dvh place-items-center lg:h-full" dir="rtl">
      <div className="flex w-full max-w-3xl flex-col items-center gap-6 px-5 text-center lg:gap-8">
        {/* Correct answer */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
          className="w-full"
        >
          <p className="mb-3 font-display text-screen-status font-bold text-ink-secondary">{t(locale, 'correctAnswer')}</p>
          <div className="flex items-center justify-center gap-3 rounded-xl3 bg-success/15 px-6 py-5 ring-2 ring-success lg:py-7">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success text-white lg:h-12 lg:w-12">
              <Check size={26} />
            </span>
            <span className="font-display text-screen-name font-black text-ink-primary">{correctText}</span>
          </div>
        </motion.div>

        {/* 1st / 2nd / 3rd */}
        {answerers.length > 0 && (
          <div className="flex w-full flex-col gap-3">
            {answerers.map((a, i) => (
              <motion.div
                key={a.participantId}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.18, type: 'spring', stiffness: 220, damping: 20 }}
                className={`flex items-center gap-4 rounded-xl2 p-3.5 lg:p-4 ${i === 0 ? 'glass-strong ring-2 ring-prize-gold shadow-gold' : 'glass'}`}
              >
                <span className="text-3xl lg:text-4xl">{MEDALS[i] ?? a.place}</span>
                <Avatar avatarId={a.avatarId} size={52} />
                <span className="flex-1 truncate text-start font-display text-screen-rankname font-black">{a.nickname}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Team-vs-team scoreboard: one card per team with total score + members. */
function TeamBoard() {
  const { teams, leaderboard, locale, round, totalRounds } = useStore();
  const ranked = [...teams].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(1, ...ranked.map((t) => t.score));

  return (
    <div className="safe flex min-h-dvh flex-col lg:h-full">
      <div className="mb-5 flex flex-col items-center gap-2.5 lg:mb-8">
        <RoundChip round={round} totalRounds={totalRounds} locale={locale} />
        <h2 className="text-center font-display text-screen-title font-black text-gradient">
          {t(locale, 'leaderboard')}
        </h2>
      </div>
      <div className="mx-auto grid w-full max-w-6xl flex-1 auto-cols-fr grid-flow-row gap-4 lg:grid-flow-col lg:gap-6">
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
              className={`glass-strong flex flex-col rounded-xl3 p-5 lg:p-7 ${isLeader ? 'shadow-gold ring-2 ring-prize-gold' : ''}`}
              style={{ borderTop: `8px solid ${team.color}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-display text-screen-team font-black" style={{ color: team.color }}>
                  {team.name}
                </span>
                {isLeader && <Crown className="shrink-0 text-prize-gold" size={36} />}
              </div>

              {/* big score */}
              <div className="mt-2 flex items-end gap-3">
                <span className="tnum font-display font-black text-[clamp(2.75rem,5.5vw,5.5rem)] leading-none">{team.score}</span>
                <span className="mb-1 font-display text-screen-status font-semibold text-ink-muted">{t(locale, 'points')}</span>
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

              {/* members — names only; the score is team-owned, never per-player */}
              <div className="mt-5 flex flex-1 flex-col gap-2 lg:overflow-hidden">
                <AnimatePresence>
                  {members.map((m) => (
                    <motion.div
                      key={m.participantId}
                      layout
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 rounded-xl2 bg-white px-3.5 py-2.5 shadow-glass"
                    >
                      <Avatar avatarId={m.avatarId} size={42} />
                      <span className="flex-1 truncate font-display text-screen-rankname font-semibold">{m.nickname}</span>
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
