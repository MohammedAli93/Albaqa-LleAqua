import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Play, Users } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { host } from '../socket.js';
import { Avatar } from '../components/Avatar.js';
import { HostBg } from '../components/HostBg.js';

const YELLOW_CARD = 'linear-gradient(180deg,#FFDE7E 0%,#FFEAB0 60%,#FFF4D6 100%)';
const RED_BTN = 'linear-gradient(180deg,#F2796C 0%,#E8473A 100%)';

/** Host "front door" on the painted dunes — QR + room code, players filling in. */
export function Lobby() {
  const { roomCode, joinUrl, participants, teams, locale } = useStore();
  const isTeams = teams.length > 0;

  return (
    <div className="safe relative flex min-h-dvh flex-col overflow-x-hidden overflow-y-auto p-5 text-desert-ink lg:h-full lg:p-8" dir="rtl">
      <HostBg variant={isTeams ? 'team' : 'sky'} />

      <header className="relative z-10 flex items-center justify-between gap-3">
        <img src="/art/logo-wordmark.png" alt="البقاء للأقوى" className="h-auto w-[10rem] drop-shadow-sm lg:w-[13rem]" />
        <div className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-sm backdrop-blur lg:px-5 lg:py-2.5">
          <Users className="text-[#E8473A]" size={22} />
          <span className="tnum font-display text-[clamp(1.25rem,2vw,2rem)] font-black">{participants.length}</span>
        </div>
      </header>

      <div className="relative z-10 grid flex-1 grid-cols-1 items-center gap-6 lg:grid-cols-2 lg:gap-10">
        {/* Join panel (right / RTL start) */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="order-2 flex flex-col items-center lg:order-1"
        >
          <h2 className="mb-4 font-display text-[clamp(1.25rem,2.2vw,2rem)] font-black drop-shadow-sm lg:mb-6">{t(locale, 'scanToJoin')}</h2>
          <div
            className="flex w-full max-w-[19rem] flex-col items-center gap-4 rounded-[1.75rem] px-5 py-6 shadow-[0_36px_80px_-40px_rgba(120,70,10,0.7)] ring-1 ring-white/50 lg:gap-5 lg:px-6 lg:py-7"
            style={{ backgroundImage: YELLOW_CARD }}
          >
            <div className="w-[min(60vw,12.5rem)] rounded-[1.25rem] bg-white p-3.5 shadow-lg lg:p-4">
              <QRCodeSVG value={joinUrl} size={256} level="M" className="h-auto w-full" />
            </div>
            <div className="text-center">
              <p className="font-display text-[clamp(0.95rem,1.4vw,1.5rem)] font-bold text-desert-ink/70">{t(locale, 'roomCode')}</p>
              <p className="tnum font-display text-[clamp(2rem,3.4vw,3.25rem)] font-black leading-tight tracking-[0.18em] text-desert-ink lg:tracking-[0.24em]">
                {roomCode}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Players / teams (left / RTL end) */}
        <div className="order-1 flex flex-col lg:order-2 lg:h-full">
          <h2 className="mb-3 font-display text-[clamp(1.25rem,2.2vw,2rem)] font-black drop-shadow-sm lg:mb-5">
            {isTeams ? t(locale, 'teamVsTeam') : t(locale, 'players')}
          </h2>

          {participants.length === 0 && !isTeams ? (
            <div className="grid flex-1 place-items-center rounded-[1.75rem] bg-white/55 py-10 font-display text-screen-status font-bold text-desert-ink/70 backdrop-blur-sm animate-pulse-glow lg:py-16">
              {t(locale, 'waitingForPlayers')}
            </div>
          ) : isTeams ? (
            <div className="grid auto-cols-fr grid-flow-row gap-4">
              {teams.map((team) => {
                const members = participants.filter((p) => team.memberIds.includes(p.id));
                return (
                  <div
                    key={team.id}
                    className="flex flex-col gap-3 rounded-[1.5rem] p-5 shadow-[0_24px_60px_-34px_rgba(120,70,10,0.6)] ring-1 ring-white/50 lg:p-6"
                    style={{ backgroundImage: YELLOW_CARD }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-display text-[clamp(1.25rem,2.4vw,2.25rem)] font-black" style={{ color: team.color }}>{team.name}</span>
                      <span className="tnum rounded-full bg-white/70 px-3 py-1 font-display text-[clamp(0.85rem,1.3vw,1.25rem)] font-bold text-desert-ink/70">
                        {t(locale, 'playerCount', { count: members.length })}
                      </span>
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
                            className="flex items-center gap-3 rounded-xl2 bg-white/80 px-3.5 py-2.5 shadow-sm"
                          >
                            <Avatar avatarId={p.avatarId} size={40} shape="square" />
                            <span className="truncate font-display text-[clamp(1rem,1.6vw,1.6rem)] font-bold text-desert-ink">{p.nickname}</span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 content-start gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 lg:gap-4">
              <AnimatePresence>
                {participants.map((p) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    className="flex flex-col items-center gap-2 rounded-xl2 bg-white/80 p-3 shadow-sm backdrop-blur lg:p-4"
                  >
                    <Avatar avatarId={p.avatarId} size={56} shape="square" />
                    <span className="max-w-full truncate font-display text-[clamp(0.95rem,1.5vw,1.4rem)] font-bold text-desert-ink">{p.nickname}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <footer className="sticky bottom-0 z-20 mt-4 flex justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-5">
        <motion.button
          whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.03 }}
          onClick={() => host.start().catch(() => {})}
          disabled={participants.length < 2}
          className="flex items-center gap-3 rounded-full px-12 py-4 font-display text-screen-status font-black text-white shadow-[0_18px_40px_-16px_rgba(214,58,34,0.9)] transition disabled:opacity-40 lg:px-16 lg:py-5"
          style={{ backgroundImage: RED_BTN }}
        >
          <Play fill="currentColor" /> {t(locale, 'startGame')}
        </motion.button>
      </footer>
    </div>
  );
}
