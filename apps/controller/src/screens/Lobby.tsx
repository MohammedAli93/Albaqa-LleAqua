import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Check, Users } from 'lucide-react';
import { GameType } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';
import { pickTeam } from '../socket.js';

export function Lobby() {
  const { nickname, avatarId, locale, gameType } = useStore();

  if (gameType === GameType.TEAMS) {
    return <TeamPicker />;
  }

  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-5">
        <Avatar avatarId={avatarId} size={120} selected />
        <p className="max-w-full break-words font-display text-4xl font-bold" dir="auto">{nickname}</p>
        <div className="flex items-center gap-3 text-xl text-ink-secondary">
          <Loader2 className="animate-spin" />
          {t(locale, 'waitingForPlayers')}
        </div>
      </motion.div>
    </div>
  );
}

function TeamPicker() {
  const { locale, teams, myTeamId, participantId } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function choose(teamId: string) {
    if (busy) return;
    setBusy(teamId);
    setErr(null);
    try {
      await pickTeam(teamId);
    } catch (e) {
      setErr(e instanceof Error && e.message === 'CONFLICT' ? t(locale, 'teamFull') : t(locale, 'error'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 py-8">
      <h1 className="font-display text-3xl font-black">{t(locale, 'chooseTeam')}</h1>
      <p className="mt-2 text-ink-secondary">{t(locale, 'teamVsTeam')}</p>

      <div className="mt-6 space-y-3">
        {teams.map((team, i) => {
          const count = team.memberIds.length;
          const cap = team.capacity ?? count;
          const full = count >= cap && !team.memberIds.includes(participantId ?? '');
          const mine = team.id === myTeamId;
          return (
            <motion.button
              key={team.id}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
              whileTap={{ scale: full ? 1 : 0.97 }}
              onClick={() => !full && choose(team.id)}
              disabled={full || busy === team.id}
              className={[
                'glass relative flex w-full items-center gap-4 rounded-xl3 p-5 text-start transition',
                mine ? 'ring-2 ring-offset-2 ring-offset-bg-base' : '',
                full ? 'opacity-50' : '',
              ].join(' ')}
              style={mine ? { ['--tw-ring-color' as string]: team.color } : undefined}
            >
              <span
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white"
                style={{ background: team.color }}
              >
                {mine ? <Check size={26} /> : <Users size={24} />}
              </span>
              <span className="flex-1">
                <span className="block font-display text-xl font-extrabold" style={{ color: team.color }}>
                  {team.name}
                </span>
                <span className="block text-sm text-ink-secondary tnum">
                  {count} / {cap}
                </span>
              </span>
              {full && <span className="text-sm font-semibold text-ink-muted">{t(locale, 'teamFull')}</span>}
            </motion.button>
          );
        })}
      </div>

      {err && <p className="mt-4 text-center text-danger">{err}</p>}

      <div className="mt-auto pt-8 text-center text-ink-secondary">
        {myTeamId ? (
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="animate-spin" /> {t(locale, 'waitingForPlayers')}
          </div>
        ) : (
          <p>{t(locale, 'chooseTeam')}</p>
        )}
      </div>
    </div>
  );
}
