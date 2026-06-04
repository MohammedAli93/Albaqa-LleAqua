import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PauseCircle } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from './store.js';
import { connect } from './socket.js';
import { loadSession } from './lib/config.js';
import { useWakeLock } from './hooks/useDevice.js';
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

export default function App() {
  const { appView, account, phase, paused, locale, conn, set } = useStore();
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

    // Otherwise open the app shell: home if signed in, else the splash.
    const signedIn = !!(account && account.displayName && account.country);
    set({ appView: signedIn ? 'home' : 'splash' });
  }, [set, account]);

  // ── App shell (front door) ──
  if (appView !== 'game') {
    return (
      <div className="relative min-h-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={appView}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
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
    <div className="relative min-h-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="min-h-screen"
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
            className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-bg-raised/90 py-3 text-center backdrop-blur"
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
