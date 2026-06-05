import { motion } from 'framer-motion';
import { Check, X, Users, Zap } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { CountdownRing } from '../components/CountdownRing.js';
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
  const promptAr = question.promptAr;

  return (
    <div className="safe flex h-full flex-col">
      <header className="flex items-center justify-between">
        <span className="glass rounded-xl2 px-6 py-2 font-display text-2xl font-bold text-ink-secondary">
          {t(locale, 'roundOf', { current: round, total: totalRounds })}
        </span>
        {collecting && <CountdownRing remainingMs={remaining} totalMs={roundTotalMs} size={120} />}
        <span className="glass flex items-center gap-2 rounded-xl2 px-6 py-2 font-display text-2xl font-bold">
          <Users className="text-brand-cyan" />
          <span className="tnum">{answeredCount}</span>
          <span className="text-ink-muted">/ {totalActive || '—'}</span>
        </span>
      </header>

      {question.category && (
        <motion.div
          key={`cat-${question.id}`}
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto mt-6 flex items-center gap-2 rounded-full px-6 py-2 font-display text-2xl font-bold text-white shadow-glow"
          style={{ background: question.category.color }}
        >
          {question.category.nameAr}
        </motion.div>
      )}

      <motion.h2
        key={question.id}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto mb-8 mt-5 max-w-5xl text-center font-display text-6xl font-bold leading-tight"
        dir="rtl"
      >
        {promptAr}
      </motion.h2>
      {question.promptMediaUrl && (
        <img src={question.promptMediaUrl} alt="" className="mx-auto mb-6 max-h-[28vh] rounded-xl2 object-contain" />
      )}

      <div className={`grid flex-1 content-center gap-5 ${question.options.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {question.options.map((opt, i) => {
          const isCorrect = revealing && opt.id === correctOptionId;
          const isWrong = revealing && opt.id !== correctOptionId;
          const count = distribution[opt.id] ?? 0;
          return (
            <motion.div
              key={opt.id}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{
                opacity: isWrong ? 0.4 : 1,
                scale: isCorrect ? 1.03 : 1,
              }}
              transition={{ delay: i * 0.06, type: 'spring', stiffness: 200, damping: 20 }}
              className={`glass-strong relative flex items-center gap-5 overflow-hidden rounded-xl2 p-6 ${
                isCorrect ? 'ring-4 ring-success shadow-[0_0_40px_rgba(34,197,94,0.6)]' : ''
              }`}
            >
              <span
                className="grid h-14 w-14 shrink-0 place-items-center rounded-xl font-display text-3xl font-black"
                style={{ background: OPTION_TINTS[i], color: 'white' }}
              >
                {LETTERS[i]}
              </span>
              <span className="flex-1 font-display text-3xl font-semibold" dir="rtl">
                {opt.textAr}
              </span>
              {revealing && (
                <span className="tnum flex items-center gap-2 text-2xl text-ink-secondary">
                  {isCorrect ? <Check className="text-success" /> : isWrong && count > 0 ? <X className="text-danger" /> : null}
                  {count}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* TEAMS: who answered first and earned each team's point */}
      {revealing && heroes.length > 0 && (
        <div className="flex flex-wrap justify-center gap-4 pt-5">
          {heroes.map((h) => {
            const color = teams.find((tm) => tm.id === h.teamId)?.color ?? '#4F46E5';
            return (
              <motion.div
                key={h.teamId}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
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
        <p className="pt-4 text-center text-2xl text-ink-secondary animate-pulse-glow">
          {t(locale, 'waitingForResults')}
        </p>
      )}
    </div>
  );
}
