import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';
import { GameMode } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Hearts } from '../components/Hearts.js';
import { submitAnswer } from '../socket.js';
import { serverNow } from '../lib/clock.js';
import { haptic } from '../hooks/useDevice.js';
import {
  GameShell, CenterStage, YellowCard, Pill, Squircle, AnswerPill,
} from '../components/desert.js';

export function Answer() {
  const {
    question, roundId, startsAt, endsAt, roundTotalMs, selectedOptionId, hasAnswered,
    myLives, gameMode, round, totalRounds, isTiebreak, locale,
  } = useStore();

  // Tick the 3-2-1 pre-roll on requestAnimationFrame, server-synced so the phone
  // flips to the live question at the same instant as the big screen.
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (!startsAt) return;
    let raf = 0;
    const loop = () => {
      setNow(serverNow());
      if (serverNow() < startsAt) raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [startsAt]);

  if (!question || !roundId) return null;
  const isElimination = gameMode === GameMode.ELIMINATION;
  const inPreroll = !!startsAt && now < startsAt;

  const onPick = (optionId: string) => {
    if (hasAnswered || inPreroll) return;
    haptic([12, 30, 12]);
    submitAnswer(roundId, optionId).catch(() => {});
  };

  // ── Round badge (blue pill) shown on pre-roll. ──
  const roundBadge = isTiebreak ? (
    <Pill color="orange">{t(locale, 'tieBreaker')} ⚡</Pill>
  ) : isElimination && round > 0 ? (
    <Pill color="blue">{t(locale, 'roundNum', { current: round })}</Pill>
  ) : round > 0 && totalRounds > 0 ? (
    <Pill color="blue">{t(locale, 'roundOf', { current: round, total: totalRounds })}</Pill>
  ) : null;

  // ── 3-2-1 lead-in (reference screens 19 / 21) ──
  if (inPreroll) {
    const n = Math.max(1, Math.ceil((startsAt! - now) / 1000));
    return (
      <GameShell>
        <CenterStage>
          <YellowCard className="text-center">
            <div className="flex flex-col items-center gap-5">
              {roundBadge}
              {question.category && <Pill fill={question.category.color}>{question.category.nameAr}</Pill>}
              <p className="font-display text-3xl font-black text-desert-ink">{t(locale, 'getReady')}</p>
              <Squircle size={104}>
                <motion.span
                  key={n}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                  className="font-display text-6xl font-black text-desert-night"
                >
                  {n}
                </motion.span>
              </Squircle>
            </div>
          </YellowCard>
        </CenterStage>
      </GameShell>
    );
  }

  // ── Answered & waiting (reference screen 17) ──
  if (hasAnswered) {
    return (
      <GameShell>
        <CenterStage>
          <YellowCard className="text-center">
            <div className="flex flex-col items-center gap-5">
              <Squircle size={92}><Timer size={46} strokeWidth={2.4} /></Squircle>
              <p className="font-display text-3xl font-black text-desert-ink">{t(locale, 'answerLocked')}</p>
              {isElimination && <Hearts lives={myLives} size={26} />}
              <Pill color="red" className="px-7 py-2.5 text-base">{t(locale, 'waitingForResults')}</Pill>
            </div>
          </YellowCard>
        </CenterStage>
      </GameShell>
    );
  }

  // ── Live question (reference screen 16) ──
  const totalMs = roundTotalMs || 1;
  const remainingMs = endsAt ? Math.max(0, endsAt - serverNow()) : totalMs;
  const startPct = Math.max(0, Math.min(1, remainingMs / totalMs));

  return (
    <GameShell>
      {/* slim countdown bar (kept off the card so it stays clean like the ref) */}
      <div className="px-5 pt-3">
        <div className="mx-auto h-2 w-full max-w-[460px] overflow-hidden rounded-full bg-black/20">
          <motion.div
            key={roundId}
            className="h-full rounded-full"
            initial={{ width: `${startPct * 100}%`, backgroundColor: '#18BC85' }}
            animate={{ width: '0%', backgroundColor: ['#18BC85', '#18BC85', '#FBA340', '#E0392C'] }}
            transition={{
              width: { duration: remainingMs / 1000, ease: 'linear' },
              backgroundColor: { duration: remainingMs / 1000, times: [0, 0.5, 0.75, 1], ease: 'linear' },
            }}
          />
        </div>
      </div>

      <CenterStage className="pt-3">
        <YellowCard>
          <div className="flex flex-col items-center gap-4">
            {question.category && <Pill fill={question.category.color}>{question.category.nameAr}</Pill>}
            <h2 className="text-center font-display text-2xl font-black leading-snug text-desert-ink" dir="rtl">
              {question.promptAr}
            </h2>
            {question.promptMediaUrl && (
              <img src={question.promptMediaUrl} alt="" className="max-h-[24vh] rounded-2xl object-contain" />
            )}

            <div className="mt-1 grid w-full grid-cols-1 gap-3">
              {question.options.map((opt, i) => (
                <AnswerPill
                  key={opt.id}
                  index={i}
                  text={opt.textAr}
                  picked={selectedOptionId === opt.id}
                  dimmed={hasAnswered && selectedOptionId !== opt.id}
                  disabled={hasAnswered}
                  onClick={() => onPick(opt.id)}
                />
              ))}
            </div>

            {isElimination && (
              <div className="mt-1">
                <Hearts lives={myLives} size={26} />
              </div>
            )}
          </div>
        </YellowCard>
      </CenterStage>
    </GameShell>
  );
}
