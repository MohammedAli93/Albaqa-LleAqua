import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Users, Zap, Crown, Heart } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { CountdownRing } from '../components/CountdownRing.js';
import { ConfettiBurst } from '../components/Confetti.js';
import { Avatar } from '../components/Avatar.js';
import { useCountdown } from '../hooks/useCountdown.js';

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
const TINTS = ['#4F46E5', '#14B8A6', '#F59E0B', '#FB7185', '#22C55E', '#A855F7'];

export function Question() {
  const {
    question, phase, endsAt, roundTotalMs, answeredCount, totalActive, round, totalRounds,
    correctOptionId, distribution, heroes, teams, leaderboard, locale,
  } = useStore();

  const collecting = phase === 'collecting';
  const remaining = useCountdown(endsAt, collecting);
  const revealing = phase === 'reveal';
  const isTeams = teams.length > 0;

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
        {/* meta bar */}
        <div className="flex items-center justify-between">
          <span className="glass rounded-xl2 px-3 py-1.5 font-display text-base font-bold text-ink-secondary lg:px-6 lg:py-2 lg:text-2xl">
            {t(locale, 'roundOf', { current: round, total: totalRounds })}
          </span>
          <span className="glass flex items-center gap-2 rounded-xl2 px-3 py-1.5 font-display text-base font-bold lg:px-6 lg:py-2 lg:text-2xl">
            <Users className="text-brand-cyan" />
            <span className="tnum">{answeredCount}</span>
            <span className="text-ink-muted">/ {totalActive || '—'}</span>
          </span>
        </div>

        {/* Raised question card under the spotlight */}
        <div className="grid flex-1 place-items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: 'spring', stiffness: 180, damping: 18 }}
              className="flex flex-col items-center gap-6"
            >
              {question.category && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.6, rotate: -4 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
                  className="flex items-center gap-2 rounded-full px-5 py-2 font-display text-lg font-bold text-white shadow-glow lg:px-7 lg:py-2.5 lg:text-2xl"
                  style={{ background: question.category.color }}
                >
                  {question.category.nameAr}
                </motion.div>
              )}

              {/* gradient-bordered raised card */}
              <div className="w-full rounded-[2rem] bg-gradient-cyber p-[3px] shadow-card">
                <div className="rounded-[1.9rem] bg-white px-5 py-6 lg:px-12 lg:py-10">
                  <h2 className="mx-auto max-w-4xl text-center font-display text-3xl font-black leading-tight text-ink-primary lg:text-6xl">
                    {question.promptAr}
                  </h2>
                  {question.promptMediaUrl && (
                    <img src={question.promptMediaUrl} alt="" className="mx-auto mt-6 max-h-[24vh] rounded-xl2 object-contain" />
                  )}
                </div>
              </div>

              <AnimatePresence>
                {collecting && (
                  <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}>
                    <CountdownRing remainingMs={remaining} totalMs={roundTotalMs} size={120} />
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
                  <Zap className="text-prize-gold" size={20} />
                  <span className="text-xl font-semibold">{t(locale, 'firstCorrectHero', { name: h.nickname, team: h.teamName })}</span>
                  <span className="tnum font-display text-xl font-bold text-success">+{h.pointsAwarded}</span>
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
                      <span className="ms-auto flex items-center gap-1 font-display text-base font-bold tnum lg:text-xl">
                        {isCorrect ? <Check size={22} /> : count > 0 ? <X size={22} /> : null}
                        {sharePct}%
                      </span>
                    )}
                  </div>
                  {/* body */}
                  <div className={`relative flex min-h-[4.5rem] items-center justify-center overflow-hidden rounded-b-2xl bg-white p-3 text-center shadow-card lg:min-h-[7rem] lg:p-4 ${isCorrect ? 'ring-4 ring-success' : ''}`}>
                    {revealing && (
                      <motion.div
                        aria-hidden className="absolute inset-x-0 bottom-0"
                        style={{ background: isCorrect ? 'rgba(16,185,129,0.18)' : 'rgba(15,23,42,0.06)' }}
                        initial={{ height: 0 }} animate={{ height: `${sharePct}%` }} transition={{ duration: 0.6 }}
                      />
                    )}
                    <span className="relative font-display text-base font-bold text-ink-primary lg:text-3xl">{opt.textAr}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ───────── Leaderboard rail ───────── */}
      <aside className="relative flex w-full shrink-0 flex-col lg:w-80">
        <h3 className="mb-3 flex items-center gap-2 font-display text-xl font-black text-ink-secondary lg:text-2xl">
          <Crown className="text-prize-gold" /> {t(locale, 'leaderboard')}
        </h3>
        <div className="flex flex-1 flex-col gap-2 lg:overflow-hidden">
          {isTeams ? (
            <AnimatePresence>
              {[...teams].sort((a, b) => b.score - a.score).map((tm, i) => (
                <motion.div
                  key={tm.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass-strong flex items-center gap-3 rounded-xl2 p-3"
                  style={{ borderInlineStart: `5px solid ${tm.color}` }}
                >
                  <span className="tnum w-6 text-center font-display text-2xl font-black text-ink-muted">{i + 1}</span>
                  <span className="flex-1 truncate font-display text-xl font-extrabold" style={{ color: tm.color }}>{tm.name}</span>
                  {tm.lives != null && (
                    <span className="flex gap-0.5">
                      {Array.from({ length: Math.max(0, tm.lives) }).map((_, k) => (
                        <Heart key={k} size={14} className="fill-action text-action" />
                      ))}
                    </span>
                  )}
                  <span className="tnum font-display text-2xl font-bold">{tm.score}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <AnimatePresence>
              {leaderboard.slice(0, 8).map((e) => {
                const out = e.status === 'ELIMINATED';
                return (
                  <motion.div
                    key={e.participantId}
                    layout
                    layoutId={`rail-${e.participantId}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: out ? 0.4 : 1, x: 0, filter: out ? 'grayscale(1)' : 'none' }}
                    className={`glass-strong flex items-center gap-3 rounded-xl2 p-2.5 ${e.rank === 1 && !out ? 'ring-2 ring-prize-gold' : ''}`}
                  >
                    <span className={`tnum w-6 text-center font-display text-xl font-black ${e.rank === 1 && !out ? 'text-gold-gradient' : 'text-ink-muted'}`}>{e.rank}</span>
                    <Avatar avatarId={e.avatarId} size={36} />
                    <span className="flex-1 truncate font-display text-lg font-semibold">{e.nickname}</span>
                    <span className="tnum font-display text-xl font-bold">{e.score}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {phase === 'locked' && (
          <p className="mt-3 text-center text-xl text-ink-secondary animate-pulse-glow">{t(locale, 'waitingForResults')}</p>
        )}
      </aside>
    </div>
  );
}
