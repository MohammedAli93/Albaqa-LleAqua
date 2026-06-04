import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { submitAnswer } from '../socket.js';
import { haptic } from '../hooks/useDevice.js';
import { useCountdown } from '../hooks/useCountdown.js';

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
const TINTS = ['#7C3AED', '#22D3EE', '#F59E0B', '#EF4444', '#22C55E', '#C026D3'];

export function Answer() {
  const { question, roundId, endsAt, roundTotalMs, selectedOptionId, hasAnswered, myLives, locale } = useStore();
  const remaining = useCountdown(endsAt, !hasAnswered);
  if (!question || !roundId) return null;

  const onPick = (optionId: string) => {
    if (hasAnswered) return;
    haptic([12, 30, 12]);
    submitAnswer(roundId, optionId).catch(() => {});
  };

  const pct = Math.max(0, Math.min(1, remaining / roundTotalMs));

  return (
    <div className="flex min-h-full flex-col px-4 py-5">
      {/* timer bar */}
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: pct > 0.5 ? '#22D3EE' : pct > 0.25 ? '#F59E0B' : '#EF4444' }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ ease: 'linear', duration: 0.2 }}
        />
      </div>

      {question.category && (
        <div
          className="mx-auto mb-3 w-fit rounded-full px-4 py-1 text-sm font-bold text-white"
          style={{ background: question.category.color }}
        >
          {question.category.nameAr}
        </div>
      )}
      <h2 className="mb-5 text-center font-display text-2xl font-bold leading-snug" dir="rtl">
        {question.promptAr}
      </h2>

      <div className="grid flex-1 grid-cols-1 content-center gap-3">
        {question.options.map((opt, i) => {
          const picked = selectedOptionId === opt.id;
          const dimmed = hasAnswered && !picked;
          return (
            <motion.button
              key={opt.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPick(opt.id)}
              disabled={hasAnswered}
              animate={{ opacity: dimmed ? 0.35 : 1, scale: picked ? 1.02 : 1 }}
              className={`flex min-h-[64px] items-center gap-4 rounded-2xl glass p-4 text-start ${picked ? 'ring-4 ring-prize-gold' : ''}`}
              style={picked ? { background: 'rgba(245,197,24,0.12)' } : undefined}
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl font-display text-2xl font-black text-white" style={{ background: TINTS[i] }}>
                {LETTERS[i]}
              </span>
              <span className="flex-1 text-xl font-semibold" dir="rtl">{opt.textAr}</span>
              {picked && <Check className="text-prize-gold" />}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-ink-secondary">
        <span>{t(locale, 'lives')}: <span className="tnum font-bold text-ink-primary">{myLives}</span></span>
        {hasAnswered && <span className="font-bold text-prize-gold animate-pulse-glow">{t(locale, 'answerLocked')}</span>}
      </div>
    </div>
  );
}
