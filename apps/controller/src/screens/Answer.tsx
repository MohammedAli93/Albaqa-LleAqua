import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';
import { GameMode, GameType } from '@tahaddi/shared';
import { t, roundLabel, teamLabel } from '@tahaddi/i18n';
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
    myLives, gameMode, gameType, round, totalRounds, isTiebreak, locale, isFreeTrial,
    turnTeam, isSteal, myTeamId, pendingStealTeam, teams, participants, participantId,
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
  // TEAMS games are turn-based: one team owns each question. If it isn't ours we
  // watch this one out — the server rejects out-of-turn answers anyway, but the
  // phone shouldn't dangle buttons that can't be pressed.
  const myTurn = !turnTeam || turnTeam.teamId === myTeamId;
  // TEAMS: the team answers with one voice — its leader's. Teammates see the
  // question and advise, but the buttons are the leader's alone (client rule
  // 2026-08-12: four players each picking a different option always scored).
  const isTeams = gameType === GameType.TEAMS;
  const myTeam = teams.find((tm) => tm.id === myTeamId);
  const leaderId = myTeam?.leaderId;
  const amLeader = !isTeams || !leaderId || leaderId === participantId;
  const leaderName = participants.find((p) => p.id === leaderId)?.nickname ?? '';

  const onPick = (optionId: string) => {
    if (hasAnswered || inPreroll || !myTurn || !amLeader) return;
    haptic([12, 30, 12]);
    submitAnswer(roundId, optionId).catch(() => {});
  };

  // ── Turn badge (TEAMS): whose question this is, and whether it's a steal. ──
  const turnBadge = !turnTeam ? null : isSteal ? (
    <Pill color={myTurn ? 'orange' : 'blue'}>
      {myTurn ? t(locale, 'teamStealYours') : t(locale, 'teamStealOther', { team: teamLabel(locale, turnTeam.name) })}
    </Pill>
  ) : (
    <Pill color={myTurn ? 'green' : 'blue'}>
      {myTurn ? t(locale, 'teamTurnYours') : t(locale, 'teamTurnOther', { team: teamLabel(locale, turnTeam.name) })}
    </Pill>
  );

  // ── Round badge (blue pill) shown on pre-roll. ──
  const roundBadge = isTiebreak ? (
    <Pill color="orange">{t(locale, 'tieBreaker')} ⚡</Pill>
  ) : round > 0 ? (
    <Pill color="blue">{roundLabel(locale, round, totalRounds)}</Pill>
  ) : null;

  // ── 3-2-1 lead-in (reference screens 19 / 21) ──
  if (inPreroll) {
    const n = Math.max(1, Math.ceil((startsAt! - now) / 1000));
    return (
      <GameShell>
        <CenterStage>
          <YellowCard className="text-center">
            <div className="flex flex-col items-center gap-5">
              {/* First question past the free-15 — say the trial set is looping now
                  and what the full version adds (client 2026-08-28). */}
              {isFreeTrial && totalRounds > 0 && round === totalRounds + 1 && (
                <div className="w-full rounded-2xl bg-[#FBF1CE] px-4 py-3 text-center shadow-[inset_0_2px_3px_rgba(180,120,20,0.18)]">
                  <p className="font-display text-base font-black text-[#D63A22]">🔁 {t(locale, 'freeRepeatTitle')}</p>
                  <p className="mt-1 font-display text-sm font-bold text-desert-ink/70">{t(locale, 'freeRepeatBody')}</p>
                </div>
              )}
              {roundBadge}
              {turnBadge}
              {question.category && <Pill fill={question.category.color}>{question.category.nameAr}</Pill>}
              <p className="font-display text-3xl font-black text-desert-ink">
                {turnTeam && !myTurn
                  ? t(locale, 'teamTurnWatch')
                  : !amLeader
                    ? t(locale, 'consultThenLeaderPicks')
                    : t(locale, 'getReady')}
              </p>
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

  // ── Not our turn (TEAMS): watch the other team play this one out. ──
  // The question stays visible so the whole room follows along, but there are no
  // answer buttons — pressing them would just be rejected by the server.
  if (turnTeam && !myTurn) {
    return (
      <GameShell>
        <CenterStage>
          <YellowCard>
            <div className="flex flex-col items-center gap-4">
              {turnBadge}
              {question.category && <Pill fill={question.category.color}>{question.category.nameAr}</Pill>}
              <h2
                className="text-center font-display text-2xl font-black leading-snug text-desert-ink"
                dir="rtl"
              >
                {question.promptAr}
              </h2>
              {/* They missed it and the steal is coming to US — turn the waiting
                  card into a heads-up instead of a flat "wait your turn". */}
              {pendingStealTeam && pendingStealTeam.teamId === myTeamId ? (
                <Pill color="green" className="px-7 py-2.5 text-base">{t(locale, 'teamStealYours')}</Pill>
              ) : (
                <Pill color="red" className="px-7 py-2.5 text-base">{t(locale, 'teamTurnWatch')}</Pill>
              )}
            </div>
          </YellowCard>
        </CenterStage>
      </GameShell>
    );
  }

  // ── Our question, but I'm not the leader (TEAMS) ──
  // The question stays on screen so the whole team can weigh in out loud; only the
  // leader gets buttons, which is the whole point of the rule.
  if (isTeams && !amLeader) {
    return (
      <GameShell>
        <CenterStage>
          <YellowCard>
            <div className="flex flex-col items-center gap-4">
              {turnBadge}
              {question.category && <Pill fill={question.category.color}>{question.category.nameAr}</Pill>}
              <h2 className="text-center font-display text-2xl font-black leading-snug text-desert-ink" dir="rtl">
                {question.promptAr}
              </h2>
              {question.promptMediaUrl && (
                <img src={question.promptMediaUrl} alt="" className="max-h-[22vh] rounded-2xl object-contain" />
              )}
              <div className="mt-1 grid w-full grid-cols-1 gap-2.5 opacity-60">
                {question.options.map((opt, i) => (
                  <AnswerPill key={opt.id} index={i} text={opt.textAr} disabled />
                ))}
              </div>
              <Pill color="blue" className="px-7 py-2.5 text-center text-base">
                {leaderName
                  ? t(locale, 'leaderAnswers', { name: leaderName })
                  : t(locale, 'leaderAnswersShort')}
              </Pill>
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
            {turnBadge}
            {isTeams && leaderId === participantId && (
              <Pill color="green">👑 {t(locale, 'youAreTeamLeader')}</Pill>
            )}
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
