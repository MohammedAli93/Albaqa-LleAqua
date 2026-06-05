import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { submitAnswer } from '../socket.js';
import { haptic } from '../hooks/useDevice.js';
import { useCountdown } from '../hooks/useCountdown.js';

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
const TINTS = ['#4F46E5', '#14B8A6', '#F59E0B', '#FB7185', '#22C55E', '#A855F7'];

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
      <div className="mb-4 h-2.5 w-full overflow-hidden rounded-full bg-ink-muted/15">
        <motion.div
          className="h-full rounded-full"
          style={{ background: pct > 0.5 ? '#14B8A6' : pct > 0.25 ? '#F59E0B' : '#EF4444' }}
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
          const tint = TINTS[i % TINTS.length];
          return (
            <motion.button
              key={opt.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => onPick(opt.id)}
              disabled={hasAnswered}
              animate={{ opacity: dimmed ? 0.4 : 1, scale: picked ? 1.03 : 1 }}
              className={`flex min-h-[68px] items-center gap-4 overflow-hidden rounded-2xl p-4 text-start text-white shadow-card ${picked ? 'ring-4 ring-white' : ''}`}
              style={{ background: `linear-gradient(135deg, ${tint}, ${tint}cc)` }}
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/25 font-display text-2xl font-black backdrop-blur-sm">
                {LETTERS[i]}
              </span>
              <span className="flex-1 text-xl font-bold drop-shadow-sm" dir="rtl">{opt.textAr}</span>
              {picked && <Check size={26} />}
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
