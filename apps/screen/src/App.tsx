import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, PauseCircle } from 'lucide-react';
import {
  DEFAULT_GAME_SETTINGS,
  LEAGUE_SETTINGS,
  CUP_SETTINGS,
  GameMode,
  type CreateRoomResponse,
} from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { api, CONTROLLER_URL } from './lib/config.js';
import { useStore } from './store.js';
import { connectHost, host } from './socket.js';
import { startDemoBots } from './demo.js';
import { ParticleField } from './components/ParticleField.js';
import { Lobby } from './scenes/Lobby.js';
import { Question } from './scenes/Question.js';
import { Scoreboard } from './scenes/Scoreboard.js';
import { Winner } from './scenes/Winner.js';
import { SeenJeem } from './scenes/SeenJeem.js';

type Pkg = { id: string };

export default function App() {
  const { status, phase, mode, paused, roomCode, conn, locale, setRoom } = useStore();
  const [error, setError] = useState<string | null>(null);
  const booted = useRef(false);

  // Host bootstrap: create a room and connect as host.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    // Demo / attract mode: `?demo=N` fills the lobby with N bots and auto-plays,
    // so the full game can be previewed without real phones.
    const params = new URLSearchParams(window.location.search);
    const demoParam = params.get('demo');
    const demo = demoParam !== null;
    const demoCount = Math.min(Math.max(parseInt(demoParam ?? '8', 10) || 8, 2), 24);

    (async () => {
      try {
        const { packages } = await api<{ packages: Pkg[] }>('/api/v1/packages/public');
        if (!packages.length) throw new Error('No published packages. Run the seed.');

        // `?mode=league|cup|seenjeem` selects the format (default = elimination).
        // `?name=` sets the tournament/session display name (اسم البطولة).
        const modeParam = (params.get('mode') ?? '').toLowerCase();
        const tournamentName = params.get('name') ?? undefined;
        const base =
          modeParam === 'league'
            ? LEAGUE_SETTINGS
            : modeParam === 'cup'
              ? CUP_SETTINGS
              : modeParam === 'seenjeem'
                ? { ...DEFAULT_GAME_SETTINGS, mode: GameMode.SEEN_JEEM }
                : demo
                  ? { ...DEFAULT_GAME_SETTINGS, livesPerPlayer: 3, intermissionSec: 4, totalRounds: 8 }
                  : DEFAULT_GAME_SETTINGS;
        const settings = tournamentName ? { ...base, tournamentName } : base;

        const room = await api<CreateRoomResponse>('/api/v1/rooms', {
          method: 'POST',
          body: JSON.stringify({ packageId: packages[0]!.id, settings }),
        });
        setRoom(room.roomCode, `${CONTROLLER_URL}/?c=${room.roomCode}`);
        useStore.getState().setConn('connecting');
        connectHost(room.hostToken, room.roomCode);

        if (demo) {
          // Let the host socket connect, spawn bots (watch them fly into the
          // lobby), then auto-start so it's hands-free.
          window.setTimeout(() => startDemoBots(room.roomCode, demoCount), 1200);
          window.setTimeout(() => void host.start().catch(() => {}), 6500);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to start');
      }
    })();
  }, [setRoom]);

  const scene = pickScene(status, phase, mode, roomCode, conn);

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-stage">
      <ParticleField />

      {error && (
        <div className="grid h-full place-items-center text-center">
          <div className="glass-strong rounded-xl3 p-12">
            <p className="font-display text-4xl font-bold text-danger">{t(locale, 'error')}</p>
            <p className="mt-4 text-xl text-ink-secondary">{error}</p>
          </div>
        </div>
      )}

      {!error && (
        <AnimatePresence mode="wait">
          <motion.div
            key={scene}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="h-full w-full"
          >
            {scene === 'connecting' && <Connecting label={t(locale, 'connecting')} />}
            {scene === 'lobby' && <Lobby />}
            {scene === 'question' && <Question />}
            {scene === 'seenjeem' && <SeenJeem />}
            {scene === 'scoreboard' && <Scoreboard />}
            {scene === 'winner' && <Winner />}
          </motion.div>
        </AnimatePresence>
      )}

      <AnimatePresence>
        {paused && status !== 'COMPLETED' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-bg-base/80 backdrop-blur-md"
          >
            <div className="flex flex-col items-center gap-4">
              <PauseCircle size={80} className="text-brand-cyan animate-pulse-glow" />
              <p className="font-display text-5xl font-bold">{t(locale, 'paused')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function pickScene(
  status: string,
  phase: string,
  mode: string,
  roomCode: string,
  conn: string,
): 'connecting' | 'lobby' | 'question' | 'seenjeem' | 'scoreboard' | 'winner' {
  if (status === 'COMPLETED') return 'winner';
  if (!roomCode || conn === 'connecting') return 'connecting';
  if (status === 'LOBBY') return 'lobby';
  if (mode === 'SEEN_JEEM') return 'seenjeem';
  if (phase === 'intermission') return 'scoreboard';
  if (phase === 'collecting' || phase === 'locked' || phase === 'reveal') return 'question';
  return 'lobby';
}

function Connecting({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex flex-col items-center gap-6">
        <Loader2 size={64} className="animate-spin text-brand-violet" />
        <p className="font-display text-3xl font-bold text-ink-secondary">{label}</p>
      </div>
    </div>
  );
}
