import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PauseCircle } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from './store.js';
import { connect } from './socket.js';
import { loadSession } from './lib/config.js';
import { useWakeLock } from './hooks/useDevice.js';
import { Join } from './screens/Join.js';
import { Lobby } from './screens/Lobby.js';
import { Answer } from './screens/Answer.js';
import { Result } from './screens/Result.js';
import { Eliminated } from './screens/Eliminated.js';
import { Finished } from './screens/Finished.js';
import { SeenJeem } from './screens/SeenJeem.js';

export default function App() {
  const { phase, paused, locale, conn, set } = useStore();
  const booted = useRef(false);

  useWakeLock(phase === 'question' || phase === 'locked');

  // Pick up ?c=CODE and auto-reconnect if we have a saved session.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = (params.get('c') ?? '').toUpperCase();
    if (!code) return;
    set({ roomCode: code });
    const saved = loadSession(code);
    if (saved) {
      set({ participantId: saved.participantId, nickname: saved.nickname, avatarId: saved.avatarId });
      connect(code, saved.sessionToken);
    } else {
      connect(code);
    }
  }, [set]);

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
