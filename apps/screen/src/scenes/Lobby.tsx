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
    <div className="safe flex h-full flex-col">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-5xl font-black text-gradient">{t(locale, 'appName')}</h1>
        <div className="glass flex items-center gap-3 rounded-xl2 px-6 py-3">
          <Users className="text-brand-cyan" />
          <span className="tnum font-display text-3xl font-bold">{participants.length}</span>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-2 items-center gap-12">
        {/* Join panel */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="glass-strong flex flex-col items-center gap-6 rounded-xl3 p-12"
        >
          <p className="font-display text-4xl font-bold">{t(locale, 'scanToJoin')}</p>
          <div className="rounded-xl3 bg-white p-6 shadow-glow">
            <QRCodeSVG value={joinUrl} size={280} level="M" />
          </div>
          <div className="text-center">
            <p className="text-ink-secondary">{t(locale, 'roomCode')}</p>
            <p className="tnum font-display text-7xl font-black tracking-[0.3em] text-gold-gradient">
              {roomCode}
            </p>
          </div>
        </motion.div>

        {/* Players */}
        <div className="flex h-full flex-col">
          <p className="mb-6 font-display text-3xl font-bold text-ink-secondary">
            {isTeams ? t(locale, 'teamVsTeam') : t(locale, 'players')}
          </p>
          {participants.length === 0 && !isTeams ? (
            <div className="grid flex-1 place-items-center text-2xl text-ink-muted animate-pulse-glow">
              {t(locale, 'waitingForPlayers')}
            </div>
          ) : isTeams ? (
            <div className="grid auto-cols-fr grid-flow-col gap-4 overflow-hidden">
              {teams.map((team) => {
                const members = participants.filter((p) => team.memberIds.includes(p.id));
                return (
                  <div key={team.id} className="glass flex flex-col gap-3 rounded-xl3 p-5" style={{ borderTop: `4px solid ${team.color}` }}>
                    <div className="flex items-center justify-between">
                      <span className="font-display text-2xl font-extrabold" style={{ color: team.color }}>{team.name}</span>
                      <span className="tnum text-xl text-ink-secondary">{members.length}/{team.capacity ?? '∞'}</span>
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
                            className="flex items-center gap-3 rounded-xl2 bg-white px-3 py-2 shadow-glass"
                          >
                            <Avatar avatarId={p.avatarId} size={36} />
                            <span className="truncate text-lg font-semibold">{p.nickname}</span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 content-start gap-4 overflow-hidden">
              <AnimatePresence>
                {participants.map((p) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    className="glass flex flex-col items-center gap-2 rounded-xl2 p-4"
                  >
                    <Avatar avatarId={p.avatarId} size={56} />
                    <span className="max-w-full truncate text-lg font-semibold">{p.nickname}</span>
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
          className="flex items-center gap-3 rounded-full bg-gradient-brand px-12 py-5 font-display text-3xl font-bold text-white shadow-glow transition enabled:hover:scale-[1.03] disabled:opacity-40"
        >
          <Play fill="white" /> {t(locale, 'startGame')}
        </button>
      </footer>
    </div>
  );
}
