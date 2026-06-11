import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { GameMode } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Hearts } from '../components/Hearts.js';
import { submitAnswer } from '../socket.js';
import { haptic } from '../hooks/useDevice.js';

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
const TINTS = ['#4F46E5', '#14B8A6', '#F59E0B', '#FB7185', '#22C55E', '#A855F7'];

export function Answer() {
  const { question, roundId, startsAt, endsAt, roundTotalMs, selectedOptionId, hasAnswered, myLives, gameMode, locale } = useStore();

  // Tick while in the 3-2-1 pre-roll so the countdown number updates.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startsAt || Date.now() >= startsAt) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= startsAt) window.clearInterval(id);
    }, 150);
    return () => window.clearInterval(id);
  }, [startsAt]);

  if (!question || !roundId) return null;
  const isElimination = gameMode === GameMode.ELIMINATION;
  const inPreroll = !!startsAt && now < startsAt;

  const onPick = (optionId: string) => {
    if (hasAnswered || inPreroll) return;
    haptic([12, 30, 12]);
    submitAnswer(roundId, optionId).catch(() => {});
  };

  // 3-2-1 lead-in: show the category + a big countdown, hold the options back so
  // nobody can answer before the question is live.
  if (inPreroll) {
    const n = Math.max(1, Math.ceil((startsAt! - now) / 1000));
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        {question.category && (
          <div className="rounded-full px-4 py-1 text-sm font-bold text-white" style={{ background: question.category.color }}>
            {question.category.nameAr}
          </div>
        )}
        <p className="font-display text-xl font-bold text-ink-secondary">{t(locale, 'getReady')}</p>
        <motion.span
          key={n}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}
          className="font-display text-[7rem] font-black leading-none text-brand-deep"
        >
          {n}
        </motion.span>
      </div>
    );
  }

  // Drive the timer bar with a single GPU-accelerated keyframe animation instead
  // of a per-frame React countdown — no re-renders of the whole question/options
  // tree 60×/sec. Keyed by roundId so it restarts cleanly for each new question.
  const totalMs = roundTotalMs || 1;
  const remainingMs = endsAt ? Math.max(0, endsAt - Date.now()) : totalMs;
  const startPct = Math.max(0, Math.min(1, remainingMs / totalMs));

  return (
    <div className="flex min-h-dvh flex-col px-4 py-5">
      {/* timer bar */}
      <div className="mb-4 h-2.5 w-full shrink-0 overflow-hidden rounded-full bg-ink-muted/15">
        <motion.div
          key={roundId}
          className="h-full rounded-full"
          initial={{ width: `${startPct * 100}%`, backgroundColor: '#14B8A6' }}
          animate={{ width: '0%', backgroundColor: ['#14B8A6', '#14B8A6', '#F59E0B', '#EF4444'] }}
          transition={{
            width: { duration: remainingMs / 1000, ease: 'linear' },
            backgroundColor: { duration: remainingMs / 1000, times: [0, 0.5, 0.75, 1], ease: 'linear' },
          }}
        />
      </div>

      {question.category && (
        <div
          className="mx-auto mb-3 w-fit shrink-0 rounded-full px-4 py-1 text-sm font-bold text-white"
          style={{ background: question.category.color }}
        >
          {question.category.nameAr}
        </div>
      )}
      <h2 className="mb-5 shrink-0 text-center font-display text-2xl font-bold leading-snug" dir="rtl">
        {question.promptAr}
      </h2>

      {/* Scrollable, vertically-centred option list. `min-h-0` lets this flex
          child shrink so it can scroll; `my-auto` centres when there's room and
          collapses when options overflow — so 5–6 options never get clipped on
          short screens or in landscape. */}
      <div className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1 py-1">
        <div className="my-auto grid w-full grid-cols-1 gap-3">
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
      </div>

      <div className="mt-4 shrink-0 flex items-center justify-between text-ink-secondary">
        {isElimination ? <Hearts lives={myLives} size={26} /> : <span />}
        {hasAnswered && <span className="font-bold text-prize-gold animate-pulse-glow">{t(locale, 'answerLocked')}</span>}
      </div>
    </div>
  );
}
