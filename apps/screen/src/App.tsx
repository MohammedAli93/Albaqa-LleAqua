import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, PauseCircle } from 'lucide-react';
import {
  DEFAULT_GAME_SETTINGS,
  POINTS_SETTINGS,
  ELIMINATION_SETTINGS,
  DEFAULT_TEAM_COUNT,
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
import { useWakeLock } from './hooks/useWakeLock.js';
import { Setup } from './scenes/Setup.js';
import { Lobby } from './scenes/Lobby.js';
import { Question } from './scenes/Question.js';
import { Scoreboard } from './scenes/Scoreboard.js';
import { Winner } from './scenes/Winner.js';
import { SeenJeem } from './scenes/SeenJeem.js';

type Pkg = { id: string };

/** Build frozen game settings from a chosen type + mode (+ team names). */
function buildSettings(opts: {
  type: GameType;
  mode: GameMode;
  teamNames?: string[];
  demo?: boolean;
  name?: string;
  categoryId?: string;
}): GameSettings {
  const { type, mode, teamNames, demo, name, categoryId } = opts;
  // Team mode is always points (never elimination). Seen Jeem is its own mode.
  const effectiveMode = type === GameType.TEAMS && mode === GameMode.ELIMINATION ? GameMode.POINTS : mode;
  let base: GameSettings =
    effectiveMode === GameMode.ELIMINATION
      ? ELIMINATION_SETTINGS
      : effectiveMode === GameMode.SEEN_JEEM
        ? { ...DEFAULT_GAME_SETTINGS, mode: GameMode.SEEN_JEEM }
        : POINTS_SETTINGS;
  base = { ...base, type };
  if (type === GameType.TEAMS) {
    const names = teamNames && teamNames.length >= 2 ? teamNames : Array.from({ length: DEFAULT_TEAM_COUNT }, (_, i) => `الفريق ${i + 1}`);
    // Points-only, unlimited team size (players choose freely).
    base = { ...base, teamNames: names, teamCount: names.length, playersPerTeam: undefined };
  }
  if (categoryId) base = { ...base, categoryId };
  if (demo) base = { ...base, intermissionSec: 4, totalRounds: base.totalRounds ?? 8 };
  if (name) base = { ...base, tournamentName: name };
  return base;
}

export default function App() {
  const { status, phase, mode, paused, roomCode, conn, locale, setRoom } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [needSetup, setNeedSetup] = useState(false);
  const [setupType, setSetupType] = useState<GameType | null>(null);
  const [catParam, setCatParam] = useState<string | undefined>(undefined);
  const booted = useRef(false);

  // Hold a screen wake-lock once a room exists so the host display never sleeps
  // (a sleeping host drops its socket and pauses the game).
  useWakeLock(!!roomCode && status !== 'COMPLETED');

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
    // (+ &names=Falcons,Lions &name=). Demo uses elimination by default.
    const typeParam = (params.get('type') ?? '').toUpperCase();
    const modeParam = (params.get('mode') ?? '').toLowerCase();
    const catParamUrl = params.get('cat') ?? undefined;
    setCatParam(catParamUrl);
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
    const namesParam = params.get('names');
    const teamNames = namesParam
      ? namesParam.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    // Team games (other than Seen Jeem) must have the host name the teams first —
    // open Setup at the name-entry step instead of auto-creating the room.
    if (type === GameType.TEAMS && gameMode !== GameMode.SEEN_JEEM && !teamNames) {
      setSetupType(GameType.TEAMS);
      setNeedSetup(true);
      return;
    }

    const settings = buildSettings({
      type: gameMode === GameMode.SEEN_JEEM ? GameType.TEAMS : type,
      mode: gameMode,
      teamNames,
      demo,
      name: params.get('name') ?? undefined,
      categoryId: catParamUrl,
    });
    void createAndHost(settings, demo, demoCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scene = pickScene(status, phase, mode, roomCode, conn);

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden bg-gradient-stage lg:h-full lg:overflow-hidden">
      <ParticleField />

      {error && (
        <div className="grid min-h-dvh place-items-center p-5 text-center lg:h-full">
          <div className="glass-strong rounded-xl3 p-6 lg:p-12">
            <p className="font-display text-4xl font-bold text-danger">{t(locale, 'error')}</p>
            <p className="mt-4 text-xl text-ink-secondary">{error}</p>
          </div>
        </div>
      )}

      {!error && needSetup && (
        <Setup
          initialType={setupType}
          onConfirm={(sel) => void createAndHost(buildSettings({ ...sel, categoryId: catParam }), !!sel.demo)}
        />
      )}

      {!error && !needSetup && (
        <AnimatePresence mode="wait">
          <motion.div
            key={scene}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="min-h-dvh w-full lg:h-full"
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
    <div className="grid min-h-dvh place-items-center lg:h-full">
      <div className="flex flex-col items-center gap-6">
        <Loader2 size={64} className="animate-spin text-brand-violet" />
        <p className="font-display text-3xl font-bold text-ink-secondary">{label}</p>
      </div>
    </div>
  );
}
