import { motion } from 'framer-motion';
import { Check, X, Clock } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';

/** Shown after personal result arrives, or while waiting for results (locked). */
export function Result() {
  const { phase, lastResult, myScore, myLives, locale } = useStore();

  if (phase === 'locked') {
    return (
      <div className="grid min-h-full place-items-center px-6 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5">
          <Clock size={72} className="text-brand-cyan animate-pulse-glow" />
          <p className="font-display text-3xl font-bold">{t(locale, 'answerLocked')}</p>
          <p className="text-ink-secondary">{t(locale, 'waitingForResults')}</p>
        </motion.div>
      </div>
    );
  }

  const correct = lastResult?.isCorrect;
  return (
    <div
      className="grid min-h-full place-items-center px-6 text-center"
      style={{ background: correct ? 'radial-gradient(ellipse at 50% 30%, rgba(34,197,94,0.25), transparent 60%)' : 'radial-gradient(ellipse at 50% 30%, rgba(239,68,68,0.22), transparent 60%)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 16 }}
        className="flex flex-col items-center gap-5"
      >
        <div className={`grid h-28 w-28 place-items-center rounded-full ${correct ? 'bg-success' : 'bg-danger'}`} style={{ boxShadow: `0 0 50px ${correct ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.6)'}` }}>
          {correct ? <Check size={64} color="white" /> : <X size={64} color="white" />}
        </div>
        <p className="font-display text-4xl font-black">{correct ? t(locale, 'correct') : t(locale, 'wrong')}</p>
        {lastResult && lastResult.pointsAwarded > 0 && (
          <p className="tnum font-display text-3xl font-bold text-success">+{lastResult.pointsAwarded}</p>
        )}
        <div className="flex gap-8 text-ink-secondary">
          <span>{t(locale, 'score')}: <b className="tnum text-ink-primary">{myScore}</b></span>
          <span>{t(locale, 'lives')}: <b className="tnum text-ink-primary">{myLives}</b></span>
        </div>
      </motion.div>
    </div>
  );
}
