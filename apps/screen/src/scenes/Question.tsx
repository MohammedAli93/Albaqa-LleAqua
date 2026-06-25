import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Users, Zap } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { CountdownRing } from '../components/CountdownRing.js';
import { ConfettiBurst } from '../components/Confetti.js';
import { Avatar } from '../components/Avatar.js';
import { Hearts } from '../components/Hearts.js';
import { HostBg } from '../components/HostBg.js';
import { RoundPill, GoldTitle, LeaderRow, avatarColor } from '../components/desert.js';
import { GameMode } from '@tahaddi/shared';
import { useCountdown } from '../hooks/useCountdown.js';

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
// Candy answer caps — matching the controller answer pills (blue·red·orange·green…).
const TINTS = ['#3C84E8', '#E0392C', '#F47C1A', '#15BC85', '#8453E6', '#F76FA3'];
const QUESTION_CARD = 'linear-gradient(180deg,#FCA438 0%,#F7872B 100%)';

export function Question() {
  const {
    question, phase, endsAt, roundTotalMs, answeredCount, totalActive, round, totalRounds,
    correctOptionId, distribution, heroes, teams, leaderboard, mode, turnPlayer, locale,
  } = useStore();

  const collecting = phase === 'collecting';
  const remaining = useCountdown(endsAt, collecting);
  const revealing = phase === 'reveal';
  const isTeams = teams.length > 0;
  const isElimination = mode === GameMode.ELIMINATION;

  if (!question) return null;
  const totalVotes = Object.values(distribution).reduce((a, b) => a + b, 0);

  return (
    <div className="safe relative flex min-h-dvh flex-col gap-6 overflow-hidden p-5 lg:h-full lg:flex-row lg:p-8" dir="rtl">
      <HostBg variant="sky" />
      {revealing && <ConfettiBurst key={`burst-${question.id}`} count={56} />}

      {/* ───────── Stage ───────── */}
      <div className="relative z-10 flex flex-1 flex-col">
        {/* meta bar — brand (left) + round / answered (right) */}
        <div className="flex items-center justify-between gap-3">
          <img src="/art/logo-wordmark.png" alt="البقاء للأقوى" className="h-auto w-[8rem] drop-shadow-sm lg:w-[11rem]" />
          <div className="flex items-center gap-2 lg:gap-3">
            <RoundPill>
              {isElimination ? t(locale, 'roundNum', { current: round }) : t(locale, 'roundOf', { current: round, total: totalRounds })}
            </RoundPill>
            <span className="flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 font-display text-screen-meta font-black text-desert-ink shadow-sm">
              <Users className="text-[#E8473A]" size={20} />
              <span className="tnum">{answeredCount}</span>
              <span className="text-desert-ink/50">/ {totalActive || '—'}</span>
            </span>
          </div>
        </div>

        {/* Question */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2 lg:gap-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: 'spring', stiffness: 180, damping: 18 }}
              className="flex w-full max-w-3xl flex-col items-center gap-4 lg:gap-5"
            >
              {turnPlayer && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2.5 rounded-full bg-white/85 px-5 py-1.5 shadow-sm"
                >
                  <Avatar avatarId={turnPlayer.avatarId} size={32} shape="square" />
                  <span className="font-display text-screen-status font-black text-desert-ink">
                    {t(locale, 'yourTurn', { name: turnPlayer.nickname })}
                  </span>
                </motion.div>
              )}
              {question.category && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.6, rotate: -4 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
                  className="flex items-center gap-2 rounded-full px-6 py-2 font-display text-screen-meta font-black text-white shadow-[0_12px_26px_-12px_rgba(0,0,0,0.5),inset_0_2px_1px_rgba(255,255,255,0.4)]"
                  style={{ background: question.category.color }}
                >
                  {question.category.nameAr}
                </motion.div>
              )}

              {/* orange question card */}
              <div className="w-full rounded-[1.75rem] p-[3px] shadow-card" style={{ backgroundImage: QUESTION_CARD }}>
                <div className="rounded-[1.6rem] px-6 py-7 lg:px-9 lg:py-10" style={{ backgroundImage: QUESTION_CARD }}>
                  <h2 className="text-center font-display text-screen-question font-black text-white drop-shadow-[0_2px_6px_rgba(150,60,0,0.35)]">
                    {question.promptAr}
                  </h2>
                  {question.promptMediaUrl && (
                    <img src={question.promptMediaUrl} alt="" className="mx-auto mt-5 max-h-[22vh] rounded-xl2 object-contain" />
                  )}
                </div>
              </div>

              <AnimatePresence>
                {collecting && (
                  <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}>
                    <CountdownRing remainingMs={remaining} totalMs={roundTotalMs} size={110} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* heroes (teams first-correct) */}
        {revealing && heroes.length > 0 && (
          <div className="mb-3 flex flex-wrap justify-center gap-3">
            {heroes.map((h) => {
              const color = teams.find((tm) => tm.id === h.teamId)?.color ?? '#5BA8F5';
              return (
                <motion.div
                  key={h.teamId}
                  initial={{ opacity: 0, y: 12, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="flex items-center gap-2 rounded-full px-5 py-2 text-white shadow-[inset_0_2px_1px_rgba(255,255,255,0.3)]"
                  style={{ background: `linear-gradient(180deg, ${color}cc, ${color})` }}
                >
                  <Zap className="text-[#FFE9A8]" size={22} />
                  <span className="font-display text-screen-status font-bold">
                    {t(locale, 'teamTookPoint', { team: h.teamName })} · {t(locale, 'answeredFirst', { name: h.nickname })}
                  </span>
                  <span className="tnum font-display text-screen-status font-black">+{h.pointsAwarded}</span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ───────── Answer caps ───────── */}
        <div className="relative pb-2">
          <div className="relative grid grid-cols-2 gap-2 lg:flex lg:items-end lg:gap-4">
            {question.options.map((opt, i) => {
              const tint = TINTS[i % TINTS.length];
              const isCorrect = revealing && opt.id === correctOptionId;
              const isWrong = revealing && opt.id !== correctOptionId;
              const count = distribution[opt.id] ?? 0;
              const sharePct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              return (
                <motion.div
                  key={opt.id}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: isWrong ? 0.4 : 1, y: isCorrect ? -18 : 0, scale: isCorrect ? 1.05 : 1 }}
                  transition={{ delay: 0.08 * i, type: 'spring', stiffness: 220, damping: 18 }}
                  className="flex flex-1 flex-col items-stretch"
                >
                  <div
                    className={`flex items-center gap-2 rounded-t-2xl px-2 py-2 text-white lg:gap-3 lg:px-4 lg:py-3 ${isCorrect ? 'shadow-[0_0_40px_rgba(21,188,133,0.6)]' : ''}`}
                    style={{ background: isCorrect ? 'linear-gradient(180deg,#39D98A,#15BC85)' : tint }}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/30 font-display text-lg font-black lg:h-11 lg:w-11 lg:text-2xl">
                      {LETTERS[i]}
                    </span>
                    {revealing && (
                      <span className="ms-auto flex items-center gap-1 font-display text-screen-meta font-black tnum">
                        {isCorrect ? <Check size={22} /> : count > 0 ? <X size={22} /> : null}
                        {sharePct}%
                      </span>
                    )}
                  </div>
                  <div className={`relative flex min-h-[4.25rem] items-center justify-center overflow-hidden rounded-b-2xl bg-white p-3 text-center shadow-card lg:min-h-[6rem] lg:p-4 ${isCorrect ? 'ring-4 ring-[#15BC85]' : ''}`}>
                    {revealing && (
                      <motion.div
                        aria-hidden className="absolute inset-x-0 bottom-0"
                        style={{ background: isCorrect ? 'rgba(21,188,133,0.18)' : 'rgba(15,23,42,0.06)' }}
                        initial={{ height: 0 }} animate={{ height: `${sharePct}%` }} transition={{ duration: 0.6 }}
                      />
                    )}
                    <span className="relative font-display text-screen-answer font-bold text-desert-ink">{opt.textAr}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ───────── Ranking rail ───────── */}
      <aside className="relative z-10 flex w-full shrink-0 flex-col lg:w-[24rem] 2xl:w-[28rem]">
        <GoldTitle className="mb-3 flex items-center justify-center gap-2 text-screen-title lg:mb-4">
          {t(locale, 'leaderboard')}
        </GoldTitle>
        <div className="flex flex-1 flex-col gap-2.5 lg:overflow-hidden">
          {isTeams ? (
            <AnimatePresence>
              {[...teams].sort((a, b) => b.score - a.score).map((tm, i) => (
                <LeaderRow
                  key={tm.id}
                  rank={i + 1}
                  name={tm.name}
                  color={tm.color}
                  highlight={i === 0}
                  value={tm.score}
                />
              ))}
            </AnimatePresence>
          ) : (
            <AnimatePresence>
              {leaderboard.slice(0, 8).map((e) => {
                const out = e.status === 'ELIMINATED';
                const leader = e.rank === 1 && !out;
                return (
                  <LeaderRow
                    key={e.participantId}
                    rank={e.rank}
                    name={e.nickname}
                    color={avatarColor(e.avatarId)}
                    avatar={<Avatar avatarId={e.avatarId} size={48} shape="square" />}
                    highlight={leader}
                    dimmed={out}
                    value={isElimination ? <Hearts lives={e.lives} size={22} /> : e.score}
                  />
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {phase === 'locked' && (
          <p className="mt-3 text-center font-display text-screen-status font-bold text-white drop-shadow animate-pulse-glow">{t(locale, 'waitingForResults')}</p>
        )}
      </aside>
    </div>
  );
}
