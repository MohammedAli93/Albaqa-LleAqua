import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Users } from 'lucide-react';
import { GameType } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';
import { CategoryPicker } from '../components/CategoryPicker.js';
import { GameShell, CenterStage, YellowCard, Pill, GOLD } from '../components/desert.js';
import { pickTeam, pickCategory } from '../socket.js';

/** Open white ring spinner (ref 15 — "waiting for host"). */
function RingSpinner({ size = 38 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-white/85 border-t-transparent"
      style={{ width: size, height: size, borderWidth: Math.max(4, size * 0.11) }}
    />
  );
}

export function Lobby() {
  const { nickname, avatarId, locale, gameType, myTeamId, perPlayerCategory, myCategoryId } = useStore();
  const isTeams = gameType === GameType.TEAMS;

  // 1. Teams: pick your team first (Team A / Team B).
  if (isTeams && !myTeamId) {
    return <TeamPicker />;
  }
  // 2. Per-player-category mode: pick your own category (single OR teams).
  if (perPlayerCategory && !myCategoryId) {
    return <CategoryChooser />;
  }
  // 3. Teams waiting room (lets you still switch team).
  if (isTeams) {
    return <TeamPicker />;
  }

  // Default — the "waiting for host" card (reference screen 15).
  return (
    <GameShell>
      <CenterStage>
        <YellowCard className="text-center">
          <div className="flex flex-col items-center gap-5">
            <Avatar avatarId={avatarId} size={108} shape="square" />
            <p className="max-w-full break-words font-display text-3xl font-black text-desert-ink" dir="auto">
              {nickname}
            </p>
            {perPlayerCategory && myCategoryId && (
              <Pill color="green">{t(locale, 'categoryChosen')} ✓</Pill>
            )}
            <RingSpinner />
            <p className="font-display text-xl font-bold text-desert-ink/90">{t(locale, 'waitingHostStart')}</p>
          </div>
        </YellowCard>
      </CenterStage>
    </GameShell>
  );
}

function CategoryChooser() {
  const { locale, set, nickname, avatarId, participantId, participants } = useStore();
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const claimedIds = new Set(
    participants
      .filter((p) => p.id !== participantId && p.categoryId)
      .map((p) => p.categoryId as string),
  );

  async function choose(categoryId: string) {
    if (busy || !categoryId) return;
    setBusy(true);
    setErr(null);
    set({ myCategoryId: categoryId });
    try {
      await pickCategory(categoryId);
    } catch {
      set({ myCategoryId: null });
      setErr(t(locale, 'categoryTaken'));
      setStarted(true);
      setBusy(false);
    }
  }

  // Step 0 — intro: confirm name, then a clear "Choose Category" button.
  if (!started) {
    return (
      <GameShell>
        <CenterStage>
          <YellowCard className="text-center">
            <div className="flex flex-col items-center gap-6">
              <Avatar avatarId={avatarId} size={100} shape="square" />
              <p className="max-w-full break-words font-display text-3xl font-black text-desert-ink" dir="auto">
                {nickname}
              </p>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setStarted(true)}
                className="w-full rounded-full py-4 font-display text-2xl font-black text-white shadow-[0_16px_30px_-14px_rgba(0,0,0,0.5)]"
                style={{ backgroundImage: 'linear-gradient(180deg,#F2796C 0%,#E8473A 100%)' }}
              >
                {t(locale, 'pickYourCategory')}
              </motion.button>
              <p className="font-display text-sm font-bold text-desert-ink/80">{t(locale, 'pickCategoryHint')}</p>
            </div>
          </YellowCard>
        </CenterStage>
      </GameShell>
    );
  }

  // Step 1/2 — the guided group → sub-category picker.
  return (
    <GameShell className="px-4 py-5">
      <h1 className="mb-1 text-center font-display text-3xl font-black" style={{ color: GOLD }}>
        {t(locale, 'pickYourCategory')}
      </h1>
      {err && <p className="mb-2 text-center text-sm font-bold text-white">{err}</p>}
      <div className="mx-auto w-full max-w-md">
        <CategoryPicker onPick={choose} claimedIds={claimedIds} />
      </div>
    </GameShell>
  );
}

function TeamPicker() {
  const { locale, teams, myTeamId } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const myTeam = teams.find((tm) => tm.id === myTeamId);

  async function choose(teamId: string) {
    if (busy) return;
    setBusy(teamId);
    setErr(null);
    try {
      await pickTeam(teamId);
    } catch {
      setErr(t(locale, 'error'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <GameShell>
      <CenterStage>
        <YellowCard>
          <h1 className="text-center font-display text-3xl font-black text-desert-ink">{t(locale, 'chooseTeam')}</h1>

          <div className="mt-6 space-y-3">
            {teams.map((team, i) => {
              const count = team.memberIds.length;
              const mine = team.id === myTeamId;
              return (
                <motion.button
                  key={team.id}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => choose(team.id)}
                  disabled={busy === team.id}
                  className={`flex w-full items-center gap-4 rounded-full p-2.5 ps-4 text-start text-white shadow-[0_14px_26px_-12px_rgba(0,0,0,0.45),inset_0_2px_1px_rgba(255,255,255,0.3)] ${
                    mine ? 'ring-4 ring-white' : ''
                  }`}
                  style={{ background: `linear-gradient(180deg, ${team.color}cc 0%, ${team.color} 100%)` }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-xl font-black">{team.name}</span>
                    <span className="block font-display text-sm font-bold text-white/80">
                      {t(locale, 'playerCount', { count })}
                    </span>
                  </span>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/25 shadow-[inset_0_2px_3px_rgba(255,255,255,0.4)]">
                    {mine ? <Check size={26} /> : <Users size={24} />}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {err && <p className="mt-4 text-center font-bold text-[#D63A22]">{err}</p>}

          <div className="mt-7 flex flex-col items-center gap-3 text-center">
            {myTeam ? (
              <>
                <p className="font-display text-lg font-black" style={{ color: myTeam.color }}>
                  {t(locale, 'youAreInTeam', { team: myTeam.name })}
                </p>
                <RingSpinner size={30} />
                <p className="font-display text-sm font-bold text-desert-ink/80">{t(locale, 'waitingHostStart')}</p>
              </>
            ) : (
              <p className="font-display font-bold text-desert-ink/80">{t(locale, 'chooseTeam')}</p>
            )}
          </div>
        </YellowCard>
      </CenterStage>
    </GameShell>
  );
}
