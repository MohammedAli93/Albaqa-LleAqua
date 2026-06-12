import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PauseCircle } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from './store.js';
import { connect } from './socket.js';
import { loadSession } from './lib/config.js';
import { useWakeLock } from './hooks/useDevice.js';
import { Aurora } from './components/Aurora.js';
// In-game flow
import { Join } from './screens/Join.js';
import { Lobby } from './screens/Lobby.js';
import { Answer } from './screens/Answer.js';
import { Result } from './screens/Result.js';
import { Eliminated } from './screens/Eliminated.js';
import { Finished } from './screens/Finished.js';
import { SeenJeem } from './screens/SeenJeem.js';
// App shell (front door)
import { Splash } from './screens/app/Splash.js';
import { Login } from './screens/app/Login.js';
import { Profile } from './screens/app/Profile.js';
import { Home } from './screens/app/Home.js';
import { Play } from './screens/app/Play.js';
import { HostApp } from './host/App.js';

export default function App() {
  const { appView, account, phase, paused, locale, conn, hostLaunch, set } = useStore();
  const booted = useRef(false);

  useWakeLock(phase === 'question' || phase === 'locked');

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    // Scan-to-join: a `?c=CODE` link (the big-screen QR) jumps straight into the
    // game, bypassing the app shell.
    const params = new URLSearchParams(window.location.search);
    const code = (params.get('c') ?? '').toUpperCase();
    if (code) {
      set({ roomCode: code, appView: 'game' });
      const saved = loadSession(code);
      if (saved) {
        set({ participantId: saved.participantId, nickname: saved.nickname, avatarId: saved.avatarId });
        connect(code, saved.sessionToken);
      } else {
        connect(code);
      }
      return;
    }

    // Otherwise open the landing page for EVERYONE (guests included). Sign-in is
    // a top-bar button on the landing, not a gate — guests can browse and play;
    // logging in just saves their wins/profile.
    set({ appView: 'home' });
  }, [set, account]);

  // ── Host mode (the "screen" engine, merged into one link) ──
  // Full-bleed, responsive phone↔TV; brings its own background + particles.
  if (appView === 'host') {
    return <HostApp launch={hostLaunch} onExit={() => set({ appView: 'home', hostLaunch: null })} />;
  }

  // ── App shell (front door) ──
  // Phone-first: on desktop the UI is a centered phone-width column, not stretched.
  if (appView !== 'game') {
    return (
      <div className="relative min-h-dvh">
        <Aurora />
        <AnimatePresence mode="wait">
          <motion.div
            key={appView}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            // Landing page is a full responsive website (mobile → desktop → TV);
            // the other shell screens stay a phone-width column.
            className={appView === 'home' ? 'w-full' : 'mx-auto w-full max-w-md'}
          >
            {appView === 'splash' && <Splash />}
            {appView === 'login' && <Login />}
            {appView === 'profile' && <Profile />}
            {appView === 'home' && <Home />}
            {appView === 'play' && <Play />}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ── In-game flow ──
  return (
    <div className="relative min-h-dvh">
      <Aurora />
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          // Phone-width column for the in-game flow, but the end-game showcase is
          // full-bleed so on desktop the celebration fills the screen like the TV
          // (instead of a narrow mobile strip).
          className={phase === 'finished' ? 'w-full' : 'mx-auto w-full max-w-md'}
        >
          {phase === 'join' && <Join />}
          {phase === 'lobby' && <Lobby />}
          {phase === 'question' && <Answer />}
          {phase === 'seenjeem' && <SeenJeem />}
          {(phase === 'locked' || phase === 'result') && <Result />}
          {phase === 'eliminated' && <Eliminated />}
          {phase === 'finished' && <Finished />}
        </motion.div>
      </AnimatePresence>

      {/* Connection / pause banners */}
      <AnimatePresence>
        {(conn === 'reconnecting' || paused) && phase !== 'join' && (
          <motion.div
            initial={{ y: -60 }}
            animate={{ y: 0 }}
            exit={{ y: -60 }}
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
            className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-bg-raised/90 pb-3 text-center backdrop-blur"
          >
            <PauseCircle size={18} className="text-brand-cyan" />
            <span className="text-sm font-semibold text-ink-secondary">
              {paused ? t(locale, 'paused') : t(locale, 'reconnecting')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
