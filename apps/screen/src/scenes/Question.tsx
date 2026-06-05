import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Users, Zap } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { CountdownRing } from '../components/CountdownRing.js';
import { ConfettiBurst } from '../components/Confetti.js';
import { useCountdown } from '../hooks/useCountdown.js';

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
const OPTION_TINTS = ['#4F46E5', '#14B8A6', '#F59E0B', '#FB7185', '#22C55E', '#A855F7'];

export function Question() {
  const {
    question, phase, endsAt, roundTotalMs, answeredCount, totalActive, round, totalRounds,
    correctOptionId, distribution, heroes, teams, locale,
  } = useStore();

  const collecting = phase === 'collecting';
  const remaining = useCountdown(endsAt, collecting);
  const revealing = phase === 'reveal';

  if (!question) return null;
  const totalVotes = Object.values(distribution).reduce((a, b) => a + b, 0);
  const answeredPct = totalActive > 0 ? Math.min(100, (answeredCount / totalActive) * 100) : 0;

  return (
    <div className="safe relative flex h-full flex-col overflow-hidden">
      {/* celebratory burst when the answer is revealed */}
      {revealing && <ConfettiBurst key={`burst-${question.id}`} count={56} />}
      {/* drifting accent blobs for life behind the content */}
      <div aria-hidden className="pointer-events-none absolute -left-32 top-10 h-[40vh] w-[40vh] rounded-full bg-brand-violet/15 blur-[120px] animate-aurora" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-[36vh] w-[36vh] rounded-full bg-brand-cyan/15 blur-[120px] animate-aurora-slow" />

      {/* Header */}
      <header className="relative flex items-center justify-between">
        <span className="glass rounded-xl2 px-6 py-2 font-display text-2xl font-bold text-ink-secondary">
          {t(locale, 'roundOf', { current: round, total: totalRounds })}
        </span>
        <AnimatePresence>
          {collecting && (
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}>
              <CountdownRing remainingMs={remaining} totalMs={roundTotalMs} size={128} />
            </motion.div>
          )}
        </AnimatePresence>
        <span className="glass flex items-center gap-2 rounded-xl2 px-6 py-2 font-display text-2xl font-bold">
          <Users className="text-brand-cyan" />
          <span className="tnum">{answeredCount}</span>
          <span className="text-ink-muted">/ {totalActive || '—'}</span>
        </span>
      </header>

      {/* Answered progress bar */}
      <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-muted/10">
        <motion.div
          className="h-full rounded-full bg-gradient-cyber"
          animate={{ width: `${answeredPct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="relative flex flex-1 flex-col"
        >
          {question.category && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6, y: -10, rotate: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14 }}
              className="mx-auto mt-6 flex items-center gap-2 rounded-full px-7 py-2.5 font-display text-2xl font-bold text-white shadow-glow"
              style={{ background: question.category.color }}
            >
              {question.category.nameAr}
            </motion.div>
          )}

          <motion.h2
            initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="mx-auto mb-8 mt-5 max-w-5xl text-center font-display text-6xl font-black leading-tight text-ink-primary"
            dir="rtl"
          >
            {question.promptAr}
          </motion.h2>
          {question.promptMediaUrl && (
            <motion.img
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              src={question.promptMediaUrl} alt=""
              className="mx-auto mb-6 max-h-[26vh] rounded-xl2 object-contain shadow-card"
            />
          )}

          {/* Options */}
          <motion.div
            className={`grid flex-1 content-center gap-5 ${question.options.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.25 } } }}
          >
            {question.options.map((opt, i) => {
              const isCorrect = revealing && opt.id === correctOptionId;
              const isWrong = revealing && opt.id !== correctOptionId;
              const count = distribution[opt.id] ?? 0;
              const sharePct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
              return (
                <motion.div
                  key={opt.id}
                  variants={{
                    hidden: { opacity: 0, y: 28, scale: 0.92 },
                    show: { opacity: 1, y: 0, scale: 1 },
                  }}
                  animate={{
                    opacity: isWrong ? 0.45 : 1,
                    scale: isCorrect ? 1.04 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                  className={`glass-strong relative flex items-center gap-5 overflow-hidden rounded-xl2 p-6 ${
                    isCorrect ? 'ring-4 ring-success shadow-[0_0_50px_rgba(16,185,129,0.55)]' : ''
                  }`}
                >
                  {/* distribution fill on reveal */}
                  {revealing && (
                    <motion.div
                      className="absolute inset-y-0 right-0 -z-0"
                      style={{ background: isCorrect ? 'rgba(16,185,129,0.16)' : 'rgba(15,23,42,0.06)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${sharePct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  )}
                  <span
                    className="relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-xl font-display text-3xl font-black text-white shadow"
                    style={{ background: OPTION_TINTS[i] }}
                  >
                    {LETTERS[i]}
                  </span>
                  <span className="relative z-10 flex-1 font-display text-3xl font-semibold text-ink-primary" dir="rtl">
                    {opt.textAr}
                  </span>
                  {revealing && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                      className="relative z-10 flex items-center gap-2 text-2xl font-bold tnum text-ink-secondary"
                    >
                      {isCorrect ? <Check className="text-success" /> : count > 0 ? <X className="text-danger" /> : null}
                      {count}
                    </motion.span>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* TEAMS: first-correct heroes */}
      {revealing && heroes.length > 0 && (
        <div className="relative flex flex-wrap justify-center gap-4 pt-5">
          {heroes.map((h) => {
            const color = teams.find((tm) => tm.id === h.teamId)?.color ?? '#4F46E5';
            return (
              <motion.div
                key={h.teamId}
                initial={{ opacity: 0, y: 16, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                className="glass-strong flex items-center gap-3 rounded-2xl px-6 py-3"
                style={{ borderInlineStart: `5px solid ${color}` }}
              >
                <Zap className="text-prize-gold" />
                <span className="text-2xl font-semibold">
                  {t(locale, 'firstCorrectHero', { name: h.nickname, team: h.teamName })}
                </span>
                <span className="tnum font-display text-2xl font-bold text-success">+{h.pointsAwarded}</span>
              </motion.div>
            );
          })}
        </div>
      )}

      {phase === 'locked' && (
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="relative pt-4 text-center text-2xl text-ink-secondary"
        >
          <span className="animate-pulse-glow">{t(locale, 'waitingForResults')}</span>
        </motion.p>
      )}
    </div>
  );
}
