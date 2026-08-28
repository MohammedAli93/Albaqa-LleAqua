import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Crown, Monitor, Play, Users } from 'lucide-react';
import { t, playersLabel } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { host } from '../socket.js';
import { Avatar } from '../components/Avatar.js';
import { HostBg } from '../components/HostBg.js';

const YELLOW_CARD = 'linear-gradient(180deg,#FFDE7E 0%,#FFEAB0 60%,#FFF4D6 100%)';
const RED_BTN = 'linear-gradient(180deg,#F2796C 0%,#E8473A 100%)';

/** Host "front door" — Figma desert comp (بقاء الأقوى1 10): QR + room code on one
 *  side, the teams (or players) filling in on the other, on the painted dunes. */
export function Lobby() {
  const { roomCode, joinUrl, participants, teams, locale, perPlayerCategory, isFreeTrial } = useStore();
  const isTeams = teams.length > 0;
  // In per-player-category mode a player only appears once they've actually picked
  // their category — so the room never shows "ghosts" who joined but haven't chosen.
  // TEAMS is the exception: a player shows up the moment they pick a team (client
  // 2026-08-28 — the host thought joins were failing), and anyone who hasn't picked
  // yet is listed separately under «لم يحدد فريقه» instead of vanishing.
  const roster = perPlayerCategory && !isTeams ? participants.filter((p) => p.categoryId) : participants;
  const unassigned = isTeams ? roster.filter((p) => !teams.some((tm) => tm.memberIds.includes(p.id))) : [];
  /** Nothing left for this player to choose before the game can start. */
  const isReady = (p: { categoryId?: string | null }) => !perPlayerCategory || !!p.categoryId;
  // A game needs at least two players; say why the button is dead rather than
  // leaving the host staring at a greyed-out «ابدأ اللعب».
  const canStart = roster.length >= 2;

  return (
    <div className="safe relative flex min-h-dvh flex-col overflow-x-hidden overflow-y-auto p-5 text-desert-ink lg:h-full lg:p-8" dir="rtl">
      <HostBg variant={isTeams ? 'team' : 'sky'} />

      {/* header — brand + live player count */}
      <header className="relative z-10 flex items-center justify-between gap-3">
        <img src="/art/logo-wordmark.png" alt="البقاء للأقوى" className="h-auto w-[10rem] drop-shadow-sm lg:w-[13rem]" />
        <div className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-sm backdrop-blur lg:px-5 lg:py-2.5">
          <Users className="text-[#E8473A]" size={22} />
          <span className="tnum font-display text-[clamp(1.25rem,2vw,2rem)] font-black">{roster.length}</span>
        </div>
      </header>

      <div className="relative z-10 grid flex-1 grid-cols-1 items-center gap-6 lg:grid-cols-2 lg:gap-10">
        {/* ─── Join panel (right / RTL start) ─── */}
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
            {/* QR capped so it fits on laptop/desktop/TV alike (not full-bleed) */}
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

        {/* ─── Players / teams (left / RTL end) ─── */}
        <div className="order-1 flex flex-col lg:order-2 lg:h-full">
          <h2 className="mb-3 font-display text-[clamp(1.25rem,2.2vw,2rem)] font-black drop-shadow-sm lg:mb-5">
            {isTeams ? t(locale, 'teamVsTeam') : t(locale, 'players')}
          </h2>

          {roster.length === 0 && !isTeams ? (
            <div className="grid flex-1 place-items-center rounded-[1.75rem] bg-white/55 py-10 font-display text-screen-status font-bold text-desert-ink/70 backdrop-blur-sm animate-pulse-glow lg:py-16">
              {t(locale, 'waitingForPlayers')}
            </div>
          ) : isTeams ? (
            <div className="grid auto-cols-fr grid-flow-row gap-4 lg:grid-flow-row">
              {teams.map((team) => {
                const members = roster.filter((p) => team.memberIds.includes(p.id));
                return (
                  <div
                    key={team.id}
                    className="flex flex-col gap-3 rounded-[1.5rem] p-5 shadow-[0_24px_60px_-34px_rgba(120,70,10,0.6)] ring-1 ring-white/50 lg:p-6"
                    style={{ backgroundImage: YELLOW_CARD }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-display text-[clamp(1.25rem,2.4vw,2.25rem)] font-black" style={{ color: team.color }}>{team.name}</span>
                      <span className="tnum rounded-full bg-white/70 px-3 py-1 font-display text-[clamp(0.85rem,1.3vw,1.25rem)] font-bold text-desert-ink/70">
                        {playersLabel(locale, members.length)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {members.length === 0 && (
                        <div className="rounded-xl2 bg-white/55 px-4 py-3 text-center font-display text-screen-status font-bold text-desert-ink/45">
                          {playersLabel(locale, 0)}
                        </div>
                      )}
                      <AnimatePresence>
                        {members.map((p) => {
                          const isLeader = team.leaderId === p.id;
                          return (
                            <motion.button
                              key={p.id}
                              layout
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => host.setLeader(team.id, p.id).catch(() => {})}
                              title={t(locale, 'makeLeader')}
                              className={`flex items-center gap-3 rounded-xl2 bg-white/80 px-3.5 py-2.5 text-start shadow-sm transition ${
                                isLeader ? 'ring-2 ring-[#E8473A]' : ''
                              }`}
                            >
                              <Avatar avatarId={p.avatarId} size={40} shape="square" />
                              <span className="min-w-0 flex-1 truncate font-display text-[clamp(1rem,1.6vw,1.6rem)] font-bold text-desert-ink">
                                {p.nickname}
                              </span>
                              {/* «جاهز» next to the name, so the host can see at a
                                  glance who is in. In the free game picking a team is
                                  all there is; the paid game also waits on a category. */}
                              {isReady(p) && (
                                <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#2FA36B] px-2.5 py-1 font-display text-[clamp(0.65rem,0.9vw,0.9rem)] font-black text-white">
                                  <Check size={14} /> {t(locale, 'playerReady')}
                                </span>
                              )}
                              {isLeader && (
                                <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#E8473A] px-2.5 py-1 font-display text-[clamp(0.65rem,0.9vw,0.9rem)] font-black text-white">
                                  <Crown size={14} /> {t(locale, 'teamLeader')}
                                </span>
                              )}
                            </motion.button>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                    {/* The leader is the only one who can lock this team's answer,
                        so the host has to be able to change who it is. */}
                    {members.length > 1 && (
                      <p className="font-display text-[clamp(0.7rem,1vw,0.95rem)] font-bold text-desert-ink/60">
                        {t(locale, 'setLeaderHint')}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Joined but hasn't tapped a team yet — listed rather than hidden, so
                  the host never thinks a player's join failed (client 2026-08-28). */}
              {unassigned.length > 0 && (
                <div className="flex flex-col gap-2 rounded-[1.5rem] bg-white/60 p-4 ring-1 ring-white/50 backdrop-blur-sm lg:p-5">
                  <span className="font-display text-[clamp(1rem,1.6vw,1.4rem)] font-black text-desert-ink/70">
                    {t(locale, 'noTeamYet')} · {playersLabel(locale, unassigned.length)}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {unassigned.map((p) => (
                      <span key={p.id} className="flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 shadow-sm">
                        <Avatar avatarId={p.avatarId} size={28} shape="square" />
                        <span className="max-w-[10rem] truncate font-display text-[clamp(0.85rem,1.3vw,1.2rem)] font-bold text-desert-ink">
                          {p.nickname}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 content-start gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 lg:gap-4">
              <AnimatePresence>
                {roster.map((p) => (
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

      {/* Sticky so the Start button is always reachable, even with a full lobby. */}
      <footer className="sticky bottom-0 z-20 mt-4 flex flex-col items-center gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-5">
        <motion.button
          whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.03 }}
          onClick={() => host.start().catch(() => {})}
          disabled={!canStart}
          className="flex items-center gap-3 rounded-full px-12 py-4 font-display text-screen-status font-black text-white shadow-[0_18px_40px_-16px_rgba(214,58,34,0.9)] transition disabled:opacity-40 lg:px-16 lg:py-5"
          style={{ backgroundImage: RED_BTN }}
        >
          <Play fill="currentColor" /> {t(locale, 'startGame')}
        </motion.button>

        {/* Why «ابدأ اللعب» is dead — a lone player can't start a game. */}
        {!canStart && (
          <p className="rounded-full bg-white/85 px-4 py-1.5 text-center font-display text-[clamp(0.8rem,1.1vw,1.05rem)] font-black text-[#E8473A] shadow-sm backdrop-blur">
            {t(locale, 'waitingSecondPlayer')}
          </p>
        )}

        {/* What the room actually needs to play: this shared screen + a phone each. */}
        <p className="flex max-w-[52rem] items-center justify-center gap-2 rounded-2xl bg-white/70 px-4 py-1.5 text-center font-display text-[clamp(0.7rem,1vw,0.95rem)] font-bold leading-snug text-desert-ink/70 backdrop-blur">
          <Monitor size={16} className="shrink-0 text-[#E8473A]" /> {t(locale, 'devicesNeeded')}
        </p>

        {/* FREE games are a trial — say so plainly here, not just on the picker, so
            nobody starts one expecting the full category game. Paid games instead
            get the "charged on start" reassurance. */}
        <p className="rounded-full bg-white/70 px-4 py-1 text-center font-display text-[clamp(0.7rem,1vw,0.95rem)] font-bold text-desert-ink/70 backdrop-blur">
          {isFreeTrial
            ? 'نسخة تجربة مجانية — ١٥ سؤال ثابت، وللفئات والأسئلة الكاملة افتح النسخة الكاملة'
            : 'لا يُخصم رصيد اللعبة إلا عند الضغط على «ابدأ»'}
        </p>
      </footer>
    </div>
  );
}
