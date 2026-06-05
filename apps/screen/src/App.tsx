import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, PauseCircle } from 'lucide-react';
import {
  DEFAULT_GAME_SETTINGS,
  POINTS_SETTINGS,
  ELIMINATION_SETTINGS,
  DEFAULT_TEAM_COUNT,
  DEFAULT_PLAYERS_PER_TEAM,
  GameType,
  GameMode,
  type GameSettings,
  type CreateRoomResponse,
} from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { api, CONTROLLER_URL } from './lib/config.js';
import { useStore } from './store.js';
import { connectHost } from './socket.js';
import { startDemoBots } from './demo.js';
import { initSfxGesture } from './lib/sfx.js';
import { ParticleField } from './components/ParticleField.js';
import { Setup } from './scenes/Setup.js';
import { Lobby } from './scenes/Lobby.js';
import { Question } from './scenes/Question.js';
import { Scoreboard } from './scenes/Scoreboard.js';
import { Winner } from './scenes/Winner.js';
import { SeenJeem } from './scenes/SeenJeem.js';

type Pkg = { id: string };

/** Build frozen game settings from a chosen type + mode (+ team config). */
function buildSettings(opts: {
  type: GameType;
  mode: GameMode;
  teamCount?: number;
  playersPerTeam?: number;
  demo?: boolean;
  name?: string;
}): GameSettings {
  const { type, mode, teamCount, playersPerTeam, demo, name } = opts;
  let base: GameSettings =
    mode === GameMode.ELIMINATION
      ? ELIMINATION_SETTINGS
      : mode === GameMode.SEEN_JEEM
        ? { ...DEFAULT_GAME_SETTINGS, mode: GameMode.SEEN_JEEM }
        : POINTS_SETTINGS;
  base = { ...base, type };
  if (type === GameType.TEAMS) {
    base = {
      ...base,
      teamCount: teamCount ?? DEFAULT_TEAM_COUNT,
      playersPerTeam: playersPerTeam ?? DEFAULT_PLAYERS_PER_TEAM,
    };
  }
  if (demo) base = { ...base, intermissionSec: 4, totalRounds: base.totalRounds ?? 8 };
  if (name) base = { ...base, tournamentName: name };
  return base;
}

export default function App() {
  const { status, phase, mode, paused, roomCode, conn, locale, setRoom } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [needSetup, setNeedSetup] = useState(false);
  const booted = useRef(false);

  async function createAndHost(settings: GameSettings, demo = false, demoCount = 8): Promise<void> {
    try {
      setError(null);
      const { packages } = await api<{ packages: Pkg[] }>('/api/v1/packages/public');
      if (!packages.length) throw new Error('No published packages. Run the seed.');
      const room = await api<CreateRoomResponse>('/api/v1/rooms', {
        method: 'POST',
        body: JSON.stringify({ packageId: packages[0]!.id, settings }),
      });
      setNeedSetup(false);
      setRoom(room.roomCode, `${CONTROLLER_URL}/?c=${room.roomCode}`);
      useStore.getState().setConn('connecting');
      connectHost(room.hostToken, room.roomCode);
      if (demo) {
        // Fill the lobby with bots; the host presses Start when ready (so there's
        // time to join from a phone and pick a team in TEAMS games).
        window.setTimeout(() => startDemoBots(room.roomCode, demoCount), 1200);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
    }
  }

  // Host bootstrap: from URL params/demo, or show the interactive Setup.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    initSfxGesture();

    const params = new URLSearchParams(window.location.search);
    const demoParam = params.get('demo');
    const demo = demoParam !== null;
    const demoCount = Math.min(Math.max(parseInt(demoParam ?? '8', 10) || 8, 2), 24);

    // Two-step launch via params: ?type=INDIVIDUAL|TEAMS&mode=points|elimination|seenjeem
    // (+ &teams= &perTeam= &name=). Demo uses elimination by default.
    const typeParam = (params.get('type') ?? '').toUpperCase();
    const modeParam = (params.get('mode') ?? '').toLowerCase();
    const hasConfig = !!typeParam || !!modeParam || demo;

    if (!hasConfig) {
      setNeedSetup(true);
      return;
    }

    const type = typeParam === 'TEAMS' ? GameType.TEAMS : GameType.INDIVIDUAL;
    const gameMode =
      modeParam === 'points'
        ? GameMode.POINTS
        : modeParam === 'elimination'
          ? GameMode.ELIMINATION
          : modeParam === 'seenjeem'
            ? GameMode.SEEN_JEEM
            : GameMode.ELIMINATION; // demo default
    const settings = buildSettings({
      type: gameMode === GameMode.SEEN_JEEM ? GameType.TEAMS : type,
      mode: gameMode,
      teamCount: params.get('teams') ? Number(params.get('teams')) : undefined,
      playersPerTeam: params.get('perTeam') ? Number(params.get('perTeam')) : undefined,
      demo,
      name: params.get('name') ?? undefined,
    });
    void createAndHost(settings, demo, demoCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {!error && needSetup && (
        <Setup onConfirm={(sel) => void createAndHost(buildSettings(sel), !!sel.demo)} />
      )}

      {!error && !needSetup && (
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
