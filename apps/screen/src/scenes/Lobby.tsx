import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Play, Users } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { host } from '../socket.js';
import { Avatar } from '../components/Avatar.js';

export function Lobby() {
  const { roomCode, joinUrl, participants, teams, locale } = useStore();
  const isTeams = teams.length > 0;

  return (
    <div className="safe flex min-h-dvh flex-col lg:h-full">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-screen-title font-black text-gradient">{t(locale, 'appName')}</h1>
        <div className="glass flex items-center gap-2 rounded-xl2 px-4 py-2 lg:gap-3 lg:px-6 lg:py-3">
          <Users className="text-brand-cyan" />
          <span className="tnum font-display text-screen-score font-bold">{participants.length}</span>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-center lg:gap-12">
        {/* Join panel */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="glass-strong mt-6 flex flex-col items-center gap-4 rounded-xl3 p-6 lg:mt-0 lg:gap-6 lg:p-12"
        >
          <p className="font-display text-screen-title font-bold">{t(locale, 'scanToJoin')}</p>
          <div className="w-full max-w-[13rem] rounded-xl3 bg-white p-4 shadow-glow lg:max-w-[18rem] lg:p-5">
            <QRCodeSVG value={joinUrl} size={280} level="M" className="h-auto w-full" />
          </div>
          <div className="text-center">
            <p className="font-display text-screen-status text-ink-secondary">{t(locale, 'roomCode')}</p>
            <p className="tnum font-display text-screen-code font-black tracking-[0.2em] text-gold-gradient lg:tracking-[0.3em]">
              {roomCode}
            </p>
          </div>
        </motion.div>

        {/* Players */}
        <div className="flex flex-col lg:h-full">
          <p className="mb-3 font-display text-screen-title font-bold text-ink-secondary lg:mb-6">
            {isTeams ? t(locale, 'teamVsTeam') : t(locale, 'players')}
          </p>
          {participants.length === 0 && !isTeams ? (
            <div className="grid flex-1 place-items-center py-8 font-display text-screen-status text-ink-muted animate-pulse-glow lg:py-0">
              {t(locale, 'waitingForPlayers')}
            </div>
          ) : isTeams ? (
            <div className="grid auto-cols-fr grid-flow-row gap-4 lg:grid-flow-col lg:overflow-hidden">
              {teams.map((team) => {
                const members = participants.filter((p) => team.memberIds.includes(p.id));
                return (
                  <div key={team.id} className="glass flex flex-col gap-3 rounded-xl3 p-5 lg:p-6" style={{ borderTop: `6px solid ${team.color}` }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-display text-screen-team font-extrabold" style={{ color: team.color }}>{team.name}</span>
                      <span className="tnum font-display text-screen-status text-ink-secondary">{t(locale, 'playerCount', { count: members.length })}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <AnimatePresence>
                        {members.map((p) => (
                          <motion.div
                            key={p.id}
                            layout
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-3 rounded-xl2 bg-white px-3.5 py-2.5 shadow-glass"
                          >
                            <Avatar avatarId={p.avatarId} size={42} />
                            <span className="truncate font-display text-screen-rankname font-semibold">{p.nickname}</span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 content-start gap-3 sm:grid-cols-4 lg:grid-cols-3 lg:gap-4 lg:overflow-hidden">
              <AnimatePresence>
                {participants.map((p) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    className="glass flex flex-col items-center gap-2 rounded-xl2 p-4 lg:p-5"
                  >
                    <Avatar avatarId={p.avatarId} size={64} />
                    <span className="max-w-full truncate font-display text-screen-rankname font-semibold">{p.nickname}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <footer className="flex justify-center pt-6">
        <button
          onClick={() => host.start().catch(() => {})}
          disabled={participants.length < 2}
          className="flex items-center gap-3 rounded-full bg-gradient-brand px-8 py-4 font-display text-screen-status font-bold text-white shadow-glow transition enabled:hover:scale-[1.03] disabled:opacity-40 lg:px-12 lg:py-5"
        >
          <Play fill="white" /> {t(locale, 'startGame')}
        </button>
      </footer>
    </div>
  );
}
