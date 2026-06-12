import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, PauseCircle, X } from 'lucide-react';
import {
  DEFAULT_GAME_SETTINGS,
  POINTS_SETTINGS,
  ELIMINATION_SETTINGS,
  DEFAULT_TEAM_COUNT,
  GameType,
  GameMode,
  GameTier,
  type GameSettings,
  type CreateRoomResponse,
} from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { api, CONTROLLER_URL } from './lib/config.js';
import { loadAccount } from '../lib/account.js';
import { useStore } from './store.js';
import { connectHost, disconnectHost } from './socket.js';
import { initSfxGesture } from './lib/sfx.js';
import { ParticleField } from './components/ParticleField.js';
import { Brand } from './components/Brand.js';
import { useWakeLock } from './hooks/useWakeLock.js';
import { Setup } from './scenes/Setup.js';
import { Lobby } from './scenes/Lobby.js';
import { Question } from './scenes/Question.js';
import { Scoreboard } from './scenes/Scoreboard.js';
import { Winner } from './scenes/Winner.js';
import { SeenJeem } from './scenes/SeenJeem.js';

/** Config handed in by the landing's "Host" action (type + mode already chosen). */
export interface HostLaunch {
  type: GameType;
  mode: GameMode;
  teamNames?: string[];
  /** Free vs paid tier (INDIVIDUAL games). Defaults FREE. */
  tier?: GameTier;
}

/** Build frozen game settings from a chosen type + mode (+ team names). */
function buildSettings(opts: {
  type: GameType;
  mode: GameMode;
  teamNames?: string[];
  demo?: boolean;
  name?: string;
  categoryId?: string;
  tier?: GameTier;
}): GameSettings {
  const { type, mode, teamNames, demo, name, categoryId, tier } = opts;
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
  if (tier) base = { ...base, tier };
  // Per-player category pick is a lobby step in EVERY game: each player chooses
  // their own category before the host starts. Exceptions: Seen Jeem (its own board
  // format), host-forced single-category games, and the FREE tier (a fixed 15-Q,
  // no-category set — paid unlocks the category game).
  const isFree = tier === GameTier.FREE;
  if (effectiveMode !== GameMode.SEEN_JEEM && !categoryId && !isFree) {
    base = { ...base, perPlayerCategory: true };
  }
  if (demo) base = { ...base, intermissionSec: 4, totalRounds: base.totalRounds ?? 8 };
  if (name) base = { ...base, tournamentName: name };
  return base;
}

/**
 * Host mode — lives inside the controller app (one link). The landing's "Host"
 * action hands in a `launch` (type + mode already chosen); Teams without names
 * drop into the Setup step to name the teams. `onExit` returns to the landing.
 */
export function HostApp({ launch, onExit }: { launch: HostLaunch | null; onExit: () => void }) {
  const { status, phase, mode, paused, roomCode, conn, locale, setRoom } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [needSetup, setNeedSetup] = useState(false);
  const [setupType, setSetupType] = useState<GameType | null>(null);
  const booted = useRef(false);

  // Hold a screen wake-lock once a room exists so the host display never sleeps
  // (a sleeping host drops its socket and pauses the game).
  useWakeLock(!!roomCode && status !== 'COMPLETED');

  async function createAndHost(settings: GameSettings, demo = false, demoCount = 8): Promise<void> {
    try {
      setError(null);
      // The server resolves the package + round count from the tier (free 15 /
      // paid 35); a logged-in host sends their token so paid games can be unlocked.
      const token = loadAccount()?.token;
      const room = await api<CreateRoomResponse>('/api/v1/rooms', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify({ settings, tier: settings.tier ?? GameTier.FREE }),
      });
      setNeedSetup(false);
      setRoom(room.roomCode, `${CONTROLLER_URL}/?c=${room.roomCode}`);
      useStore.getState().setConn('connecting');
      connectHost(room.hostToken, room.roomCode);
      if (demo) {
        // Fill the lobby with bots (solo testing); host presses Start when ready.
        const { startDemoBots } = await import('./demo.js');
        window.setTimeout(() => startDemoBots(room.roomCode, demoCount), 1200);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
    }
  }

  // Host bootstrap from the landing's launch config (no URL params here — host
  // mode runs in-app on the same origin as the player experience).
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    initSfxGesture();

    if (!launch) {
      setNeedSetup(true);
      return;
    }
    // Team games (other than Seen Jeem) need the host to name the teams first.
    if (launch.type === GameType.TEAMS && launch.mode !== GameMode.SEEN_JEEM && !launch.teamNames) {
      setSetupType(GameType.TEAMS);
      setNeedSetup(true);
      return;
    }
    const settings = buildSettings({
      type: launch.mode === GameMode.SEEN_JEEM ? GameType.TEAMS : launch.type,
      mode: launch.mode,
      teamNames: launch.teamNames,
      tier: launch.tier,
    });
    void createAndHost(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exit() {
    disconnectHost();
    onExit();
  }

  const scene = pickScene(status, phase, mode, roomCode, conn);

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden bg-gradient-stage lg:h-full lg:overflow-hidden">
      <ParticleField />

      {/* Exit host mode → back to the landing */}
      <button
        onClick={exit}
        aria-label={t(locale, 'back')}
        className="fixed left-4 top-4 z-50 grid h-10 w-10 place-items-center rounded-full bg-white/80 text-ink-secondary shadow-glass backdrop-blur transition hover:text-ink-primary"
      >
        <X size={20} />
      </button>

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
          onConfirm={(sel) => void createAndHost(buildSettings({ ...sel }), !!sel.demo)}
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
            {scene === 'connecting' && <Connecting />}
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
              <PauseCircle size={88} className="text-brand-cyan animate-pulse-glow" />
              <p className="font-display text-screen-title font-bold">{t(locale, 'paused')}</p>
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

function Connecting() {
  // Just a loading indicator (+ game logo) between scenes — no "connecting" text.
  return (
    <div className="grid min-h-dvh place-items-center lg:h-full">
      <div className="flex flex-col items-center gap-6">
        <Brand className="mb-2 text-screen-title" />
        <Loader2 size={72} className="animate-spin text-brand-violet" />
      </div>
    </div>
  );
}
