import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skull, Check } from 'lucide-react';
import { GameMode } from '@tahaddi/shared';
import type { RevealAnswerer } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import type { Locale } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';
import { Hearts } from '../components/Hearts.js';
import { HostBg } from '../components/HostBg.js';
import { RoundPill, GoldTitle, LeaderRow, avatarColor } from '../components/desert.js';

const MEDALS = ['🥇', '🥈', '🥉'];
const TEAM_CARD = 'linear-gradient(180deg,#FCEE5F 0%,#F8DE34 46%,#F3CC13 100%)';

/** How long the correct-answer + fastest-answerers recap holds before the standings. */
const RECAP_MS = 10000;

export function Scoreboard() {
  const { leaderboard, eliminatedThisRound, teams, mode, locale, question, correctOptionId, topAnswerers, round, totalRounds } = useStore();

  const hasRecap = !!correctOptionId && !!question;
  const [stage, setStage] = useState<'recap' | 'standings'>(hasRecap ? 'recap' : 'standings');
  useEffect(() => {
    if (stage !== 'recap') return;
    const id = window.setTimeout(() => setStage('standings'), RECAP_MS);
    return () => window.clearTimeout(id);
  }, [stage]);

  if (stage === 'recap' && hasRecap) {
    const correct = question!.options.find((o) => o.id === correctOptionId);
    return <Recap correctText={correct?.textAr ?? ''} answerers={topAnswerers} locale={locale} />;
  }

  if (teams.length > 0) return <TeamBoard />;

  const isElimination = mode === GameMode.ELIMINATION;
  const eliminated = new Set(eliminatedThisRound);
  return (
    <div className="safe relative flex min-h-dvh flex-col overflow-hidden lg:h-full">
      <HostBg variant="sky" />
      <div className="relative z-10 mb-5 flex flex-col items-center gap-2.5 lg:mb-8">
        {round > 0 && (isElimination || totalRounds > 0) && (
          <RoundPill>
            {isElimination ? t(locale, 'roundNum', { current: round }) : t(locale, 'roundOf', { current: round, total: totalRounds })}
          </RoundPill>
        )}
        <GoldTitle className="text-screen-title">{t(locale, 'leaderboard')}</GoldTitle>
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col gap-2.5 lg:gap-3.5 lg:overflow-hidden">
        <AnimatePresence>
          {leaderboard.map((e) => {
            const isOut = eliminated.has(e.participantId) || e.status === 'ELIMINATED';
            const isLeader = e.rank === 1 && !isOut;
            return (
              <LeaderRow
                key={e.participantId}
                rank={e.rank}
                name={e.nickname}
                color={avatarColor(e.avatarId)}
                avatar={<Avatar avatarId={e.avatarId} size={52} shape="square" />}
                highlight={isLeader}
                dimmed={isOut}
                value={
                  isElimination
                    ? (isOut ? <Skull size={22} /> : <Hearts lives={e.lives} size={22} />)
                    : e.score
                }
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Reveal recap: the correct answer, then the 1st / 2nd / 3rd fastest answerers. */
function Recap({ correctText, answerers, locale }: { correctText: string; answerers: RevealAnswerer[]; locale: Locale }) {
  return (
    <div className="safe relative grid min-h-dvh place-items-center overflow-hidden lg:h-full" dir="rtl">
      <HostBg variant="sky" />
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-6 px-5 text-center lg:gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
          className="w-full"
        >
          <p className="mb-3 font-display text-screen-status font-black text-white drop-shadow">{t(locale, 'correctAnswer')}</p>
          <div
            className="flex items-center justify-center gap-3 rounded-[1.75rem] px-6 py-5 text-white shadow-[0_22px_44px_-22px_rgba(0,0,0,0.5),inset_0_2px_1px_rgba(255,255,255,0.3)] lg:py-7"
            style={{ background: 'linear-gradient(180deg,#39D98A 0%,#15BC85 100%)' }}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/30 lg:h-12 lg:w-12">
              <Check size={26} strokeWidth={3} />
            </span>
            <span className="font-display text-screen-name font-black drop-shadow">{correctText}</span>
          </div>
        </motion.div>

        {answerers.length > 0 && (
          <div className="flex w-full flex-col gap-3">
            <p className="font-display text-screen-status font-black text-white/95 drop-shadow">
              {t(locale, 'correctAnswerers')}
            </p>
            {/* Everyone who answered correctly, fastest → slowest. Scrolls for big
                rooms; medals mark the top three, the rest are numbered by place. */}
            <div className="flex max-h-[46vh] w-full flex-col gap-2.5 overflow-y-auto pe-1 lg:max-h-[52vh]">
              {answerers.map((a, i) => (
                <motion.div
                  key={a.participantId}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(0.25 + i * 0.06, 1.6), type: 'spring', stiffness: 220, damping: 20 }}
                  className="flex shrink-0 items-center gap-3 rounded-full px-4 py-2 text-white shadow-[0_14px_26px_-16px_rgba(0,0,0,0.5),inset_0_2px_1px_rgba(255,255,255,0.3)] lg:gap-4 lg:px-5 lg:py-2.5"
                  style={{ background: `linear-gradient(180deg, ${avatarColor(a.avatarId)}cc, ${avatarColor(a.avatarId)})` }}
                >
                  <span className="w-9 shrink-0 text-center text-2xl tnum lg:text-3xl">{MEDALS[i] ?? a.place}</span>
                  <Avatar avatarId={a.avatarId} size={44} shape="square" />
                  <span className="flex-1 truncate text-start font-display text-screen-rankname font-black">{a.nickname}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Team-vs-team standings on the warm sand plate (reference screen 20). */
function TeamBoard() {
  const { teams, leaderboard, locale, round, totalRounds } = useStore();
  const ranked = [...teams].sort((a, b) => b.score - a.score);

  return (
    <div className="safe relative flex min-h-dvh flex-col overflow-hidden lg:h-full">
      <HostBg variant="team" />
      <div className="relative z-10 mb-5 flex flex-col items-center gap-2.5 lg:mb-8">
        {round > 0 && totalRounds > 0 && (
          <RoundPill>{t(locale, 'roundOf', { current: round, total: totalRounds })}</RoundPill>
        )}
        <h2
          className="text-center font-display text-screen-title font-black text-desert-ink"
          style={{ filter: 'drop-shadow(0 3px 10px rgba(255,255,255,0.5))' }}
        >
          {t(locale, 'leaderboard')}
        </h2>
      </div>
      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 auto-cols-fr grid-flow-row gap-4 lg:grid-flow-col lg:gap-6">
        {ranked.map((team, idx) => {
          const members = leaderboard.filter((e) => e.teamId === team.id);
          const isLeader = idx === 0;
          return (
            <motion.div
              key={team.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              className={`flex flex-col overflow-hidden rounded-[1.75rem] shadow-[0_30px_70px_-34px_rgba(120,70,10,0.7)] ring-1 ring-white/50 ${
                isLeader ? 'ring-4 ring-[#FFE9A8]' : ''
              }`}
              style={{ backgroundImage: TEAM_CARD }}
            >
              {/* header band — team name + big score + نقطة (ref 20) */}
              <div className="flex flex-col items-end gap-1 px-6 py-5 lg:px-8 lg:py-6" style={{ background: 'linear-gradient(180deg,#FFD93A 0%,#F6C81E 100%)' }}>
                <span className="max-w-full truncate font-display text-screen-team font-black" style={{ color: team.color }}>
                  {team.name}
                </span>
                <span className="tnum font-display font-black leading-none text-desert-night text-[clamp(2.75rem,5.5vw,5.5rem)]">
                  {team.score}
                </span>
                <span className="font-display text-screen-status font-black text-desert-ink/80">{t(locale, 'points')}</span>
              </div>

              {/* members — names only; the score is team-owned */}
              <div className="flex flex-1 flex-col gap-2 p-4 lg:overflow-hidden lg:p-5">
                <AnimatePresence>
                  {members.map((m) => (
                    <motion.div
                      key={m.participantId}
                      layout
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 rounded-2xl bg-white/85 px-3.5 py-2.5 shadow-sm"
                    >
                      <Avatar avatarId={m.avatarId} size={42} shape="square" />
                      <span className="flex-1 truncate font-display text-screen-rankname font-bold text-desert-ink">{m.nickname}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
