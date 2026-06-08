import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Users } from 'lucide-react';
import { GameType } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';
import { Spinner } from '../components/Spinner.js';
import { CategoryPicker } from '../components/CategoryPicker.js';
import { pickTeam, pickCategory } from '../socket.js';

export function Lobby() {
  const { nickname, avatarId, locale, gameType, myTeamId, perPlayerCategory, myCategoryId } = useStore();
  const isTeams = gameType === GameType.TEAMS;

  // 1. Teams: pick your team first (Team A / Team B).
  if (isTeams && !myTeamId) {
    return <TeamPicker />;
  }
  // 2. Per-player-category mode: pick your own category (single OR teams) — same
  //    lobby flow as picking a team.
  if (perPlayerCategory && !myCategoryId) {
    return <CategoryChooser />;
  }
  // 3. Teams waiting room (lets you still switch team).
  if (isTeams) {
    return <TeamPicker />;
  }

  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-5">
        <Avatar avatarId={avatarId} size={120} selected />
        <p className="max-w-full break-words font-display text-4xl font-bold" dir="auto">{nickname}</p>
        {perPlayerCategory && myCategoryId && (
          <p className="font-display text-lg font-bold text-brand-deep">{t(locale, 'categoryChosen')} ✓</p>
        )}
        <Spinner size={36} label={t(locale, 'waitingHostStart')} />
      </motion.div>
    </div>
  );
}

function CategoryChooser() {
  const { locale, set } = useStore();
  const [busy, setBusy] = useState(false);

  async function choose(categoryId: string) {
    if (busy || !categoryId) return;
    setBusy(true);
    try {
      await pickCategory(categoryId);
      set({ myCategoryId: categoryId }); // optimistic; ROOM_STATE confirms
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 py-6">
      <h1 className="font-display text-3xl font-black">{t(locale, 'pickYourCategory')}</h1>
      <CategoryPicker onPick={choose} />
    </div>
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
    <div className="flex min-h-dvh flex-col px-5 py-8">
      <h1 className="font-display text-3xl font-black">{t(locale, 'chooseTeam')}</h1>

      <div className="mt-6 space-y-3">
        {teams.map((team, i) => {
          const count = team.memberIds.length;
          const mine = team.id === myTeamId;
          return (
            <motion.button
              key={team.id}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
              whileTap={{ scale: 0.97 }}
              onClick={() => choose(team.id)}
              disabled={busy === team.id}
              className={[
                'glass relative flex w-full items-center gap-4 rounded-xl3 p-5 text-start transition',
                mine ? 'ring-2 ring-offset-2 ring-offset-bg-base' : '',
              ].join(' ')}
              style={mine ? { ['--tw-ring-color' as string]: team.color } : undefined}
            >
              <span
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white"
                style={{ background: team.color }}
              >
                {mine ? <Check size={26} /> : <Users size={24} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-xl font-extrabold" style={{ color: team.color }}>
                  {team.name}
                </span>
                <span className="block text-sm text-ink-secondary">
                  {t(locale, 'playerCount', { count })}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>

      {err && <p className="mt-4 text-center text-danger">{err}</p>}

      <div className="mt-auto pt-8 text-center">
        {myTeam ? (
          <div className="flex flex-col items-center gap-2">
            <p className="font-display text-lg font-bold" style={{ color: myTeam.color }}>
              {t(locale, 'youAreInTeam', { team: myTeam.name })}
            </p>
            <Spinner size={30} label={t(locale, 'waitingHostStart')} />
          </div>
        ) : (
          <p className="text-ink-secondary">{t(locale, 'chooseTeam')}</p>
        )}
      </div>
    </div>
  );
}
