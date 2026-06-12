import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Users, Zap, Crown } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import type { Locale } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { CountdownRing } from '../components/CountdownRing.js';
import { ConfettiBurst } from '../components/Confetti.js';
import { Avatar } from '../components/Avatar.js';
import { Brand } from '../components/Brand.js';
import { Hearts } from '../components/Hearts.js';
import { GameMode } from '@tahaddi/shared';
import { useCountdown } from '../hooks/useCountdown.js';

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
const TINTS = ['#4F46E5', '#14B8A6', '#F59E0B', '#FB7185', '#22C55E', '#A855F7'];

/** Full-screen 3-2-1 lead-in shown before a question opens for answering. */
function GetReady({ msLeft, round, totalRounds, locale }: { msLeft: number; round: number; totalRounds: number; locale: Locale }) {
  const n = Math.max(1, Math.ceil(msLeft / 1000));
  return (
    <div
      className="safe relative grid min-h-dvh place-items-center overflow-hidden lg:h-full"
      style={{ backgroundImage: 'linear-gradient(165deg, #0284C7 0%, #0EA5E9 48%, #38BDF8 100%)' }}
    >
      <div className="flex flex-col items-center gap-4 text-white lg:gap-7">
        {round > 0 && totalRounds > 0 && (
          <span className="rounded-full bg-white px-6 py-2 font-display text-screen-status font-black text-brand-deep shadow-card">
            {t(locale, 'roundOf', { current: round, total: totalRounds })}
          </span>
        )}
        <p className="font-display text-screen-title font-bold text-white/90 drop-shadow">{t(locale, 'getReady')}</p>
        <AnimatePresence mode="wait">
          <motion.span
            key={n}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 16 }}
            className="font-display font-black text-gold-gradient"
            style={{ fontSize: 'clamp(8rem, 26vw, 22rem)', lineHeight: 1, filter: 'drop-shadow(0 8px 40px rgba(245,197,24,0.6))' }}
          >
            {n}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Question() {
  const {
    question, phase, startsAt, endsAt, roundTotalMs, answeredCount, totalActive, round, totalRounds,
    correctOptionId, distribution, heroes, teams, leaderboard, mode, locale,
  } = useStore();

  const collecting = phase === 'collecting';
  const remaining = useCountdown(endsAt, collecting);
  const preMs = useCountdown(startsAt, collecting);
  const inPreroll = collecting && !!startsAt && preMs > 0;
  const revealing = phase === 'reveal';
  const isTeams = teams.length > 0;
  const isElimination = mode === GameMode.ELIMINATION;

  // 3-2-1 lead-in before the question opens for answering.
  if (inPreroll) return <GetReady msLeft={preMs} round={round} totalRounds={totalRounds} locale={locale} />;
  if (!question) return null;
  const totalVotes = Object.values(distribution).reduce((a, b) => a + b, 0);

  return (
    <div className="safe relative flex min-h-dvh flex-col gap-6 overflow-hidden lg:h-full lg:flex-row" dir="rtl">
      {revealing && <ConfettiBurst key={`burst-${question.id}`} count={56} />}

      {/* Spotlight + drifting glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-stage" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-12%] h-[55vh] w-[70vw] -translate-x-1/2 rounded-full bg-brand-violet/15 blur-[140px]" />

      {/* ───────── Stage ───────── */}
      <div className="relative flex flex-1 flex-col">
        {/* meta bar — persistent branding (left) + round / answered (right) */}
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <div className="flex items-center gap-2 lg:gap-3">
            <span className="glass rounded-xl2 px-3 py-1.5 font-display text-screen-meta font-bold text-ink-secondary lg:px-5 lg:py-2">
              {t(locale, 'roundOf', { current: round, total: totalRounds })}
            </span>
            <span className="glass flex items-center gap-2 rounded-xl2 px-3 py-1.5 font-display text-screen-meta font-bold lg:px-5 lg:py-2">
              <Users className="text-brand-cyan" />
              <span className="tnum">{answeredCount}</span>
              <span className="text-ink-muted">/ {totalActive || '—'}</span>
            </span>
          </div>
        </div>

        {/* Question — capped so it never dominates the stage; the answers and the
            ranking rail get their share of the screen. */}
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
              {question.category && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.6, rotate: -4 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
                  className="flex items-center gap-2 rounded-full px-5 py-1.5 font-display text-screen-meta font-bold text-white shadow-glow lg:px-7 lg:py-2"
                  style={{ background: question.category.color }}
                >
                  {question.category.nameAr}
                </motion.div>
              )}

              {/* gradient-bordered raised card — compact padding, capped width */}
              <div className="w-full rounded-[1.75rem] bg-gradient-cyber p-[3px] shadow-card">
                <div className="rounded-[1.6rem] bg-white px-6 py-5 lg:px-9 lg:py-7">
                  <h2 className="text-center font-display text-screen-question font-black text-ink-primary">
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
              const color = teams.find((tm) => tm.id === h.teamId)?.color ?? '#4F46E5';
              return (
                <motion.div
                  key={h.teamId}
                  initial={{ opacity: 0, y: 12, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="glass-strong flex items-center gap-2 rounded-2xl px-5 py-2"
                  style={{ borderInlineStart: `5px solid ${color}` }}
                >
                  <Zap className="text-prize-gold" size={22} />
                  <span className="font-display text-screen-status font-semibold">
                    {t(locale, 'teamTookPoint', { team: h.teamName })} · {t(locale, 'answeredFirst', { name: h.nickname })}
                  </span>
                  <span className="tnum font-display text-screen-status font-bold text-success">+{h.pointsAwarded}</span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ───────── Answer podiums ───────── */}
        <div className="relative pb-2">
          {/* stage floor */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 hidden h-24 rounded-3xl bg-gradient-to-t from-bg-sunken to-transparent lg:block" />
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
                  animate={{
                    opacity: isWrong ? 0.4 : 1,
                    y: isCorrect ? -18 : 0,
                    scale: isCorrect ? 1.05 : 1,
                  }}
                  transition={{ delay: 0.08 * i, type: 'spring', stiffness: 220, damping: 18 }}
                  className="flex flex-1 flex-col items-stretch"
                >
                  {/* colored cap with letter */}
                  <div
                    className={`flex items-center gap-2 rounded-t-2xl px-2 py-2 text-white lg:gap-3 lg:px-4 lg:py-3 ${isCorrect ? 'shadow-[0_0_40px_rgba(16,185,129,0.6)]' : ''}`}
                    style={{ background: isCorrect ? '#10B981' : tint }}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/25 font-display text-lg font-black backdrop-blur-sm lg:h-11 lg:w-11 lg:text-2xl">
                      {LETTERS[i]}
                    </span>
                    {revealing && (
                      <span className="ms-auto flex items-center gap-1 font-display text-screen-meta font-bold tnum">
                        {isCorrect ? <Check size={22} /> : count > 0 ? <X size={22} /> : null}
                        {sharePct}%
                      </span>
                    )}
                  </div>
                  {/* body */}
                  <div className={`relative flex min-h-[4.25rem] items-center justify-center overflow-hidden rounded-b-2xl bg-white p-3 text-center shadow-card lg:min-h-[6rem] lg:p-4 ${isCorrect ? 'ring-4 ring-success' : ''}`}>
                    {revealing && (
                      <motion.div
                        aria-hidden className="absolute inset-x-0 bottom-0"
                        style={{ background: isCorrect ? 'rgba(16,185,129,0.18)' : 'rgba(15,23,42,0.06)' }}
                        initial={{ height: 0 }} animate={{ height: `${sharePct}%` }} transition={{ duration: 0.6 }}
                      />
                    )}
                    <span className="relative font-display text-screen-answer font-bold text-ink-primary">{opt.textAr}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ───────── Ranking rail — high-priority, distance-readable ───────── */}
      <aside className="relative flex w-full shrink-0 flex-col lg:w-[24rem] 2xl:w-[28rem]">
        <h3 className="mb-3 flex items-center gap-2 font-display text-screen-title font-black text-gradient lg:mb-4">
          <Crown className="text-prize-gold" /> {t(locale, 'leaderboard')}
        </h3>
        <div className="flex flex-1 flex-col gap-2.5 lg:overflow-hidden">
          {isTeams ? (
            <AnimatePresence>
              {[...teams].sort((a, b) => b.score - a.score).map((tm, i) => (
                <motion.div
                  key={tm.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`glass-strong flex items-center gap-3 rounded-xl2 p-3.5 lg:p-4 ${i === 0 ? 'ring-2 ring-prize-gold shadow-gold' : ''}`}
                  style={{ borderInlineStart: `7px solid ${tm.color}` }}
                >
                  <span className="tnum w-8 text-center font-display text-screen-ranknum font-black text-ink-muted">{i + 1}</span>
                  <span className="flex-1 truncate font-display text-screen-team font-extrabold" style={{ color: tm.color }}>{tm.name}</span>
                  <span className="tnum font-display text-screen-score font-black">{tm.score}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <AnimatePresence>
              {leaderboard.slice(0, 8).map((e) => {
                const out = e.status === 'ELIMINATED';
                const leader = e.rank === 1 && !out;
                return (
                  <motion.div
                    key={e.participantId}
                    layout
                    layoutId={`rail-${e.participantId}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: out ? 0.45 : 1, x: 0, filter: out ? 'grayscale(1)' : 'none' }}
                    className={`glass-strong flex items-center gap-3 rounded-xl2 p-3 ${leader ? 'ring-2 ring-prize-gold shadow-gold' : ''}`}
                  >
                    <span className={`tnum w-9 text-center font-display text-screen-ranknum font-black ${leader ? 'text-gold-gradient' : 'text-ink-muted'}`}>{e.rank}</span>
                    <Avatar avatarId={e.avatarId} size={48} />
                    <span className="flex-1 truncate font-display text-screen-rankname font-bold">{e.nickname}</span>
                    {isElimination ? (
                      <Hearts lives={e.lives} size={24} />
                    ) : (
                      <span className="tnum font-display text-screen-score font-black">{e.score}</span>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {phase === 'locked' && (
          <p className="mt-3 text-center font-display text-screen-status text-ink-secondary animate-pulse-glow">{t(locale, 'waitingForResults')}</p>
        )}
      </aside>
    </div>
  );
}
