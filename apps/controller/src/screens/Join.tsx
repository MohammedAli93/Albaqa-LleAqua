import { useState } from 'react';
import { motion } from 'framer-motion';
import { AVATARS, GAME_LIMITS } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { connect, joinGame, getSocket } from '../socket.js';
import { Avatar } from '../components/Avatar.js';
import { haptic } from '../hooks/useDevice.js';

export function Join() {
  const { roomCode, locale, set, conn } = useStore();
  const [code, setCode] = useState(roomCode);
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState(AVATARS[0]!.id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const validCode = code.trim().length === GAME_LIMITS.ROOM_CODE_LENGTH;
  const validName = nickname.trim().length >= GAME_LIMITS.NICKNAME_MIN;

  async function handleJoin() {
    if (!validCode || !validName || busy) return;
    setBusy(true);
    setErr(null);
    haptic();
    try {
      const upper = code.trim().toUpperCase();
      set({ roomCode: upper });
      if (!getSocket() || conn !== 'connected') {
        connect(upper);
        await waitForConnect();
      }
      await joinGame(nickname.trim(), avatarId);
    } catch (e) {
      setErr(mapError(e instanceof Error ? e.message : 'ERROR', locale));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 py-6">
      <h1 className="mb-1 text-center font-display text-5xl font-black text-gradient">{t(locale, 'appName')}</h1>

      <div className="mt-6 space-y-5">
        <div>
          <label className="mb-2 block text-ink-secondary" htmlFor="code">{t(locale, 'enterRoomCode')}</label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            inputMode="text"
            autoCapitalize="characters"
            className="tnum w-full rounded-2xl glass px-5 py-4 text-center font-display text-4xl font-bold tracking-[0.3em] outline-none focus:ring-2 focus:ring-brand-violet"
            placeholder="------"
          />
        </div>

        <div>
          <label className="mb-2 block text-ink-secondary" htmlFor="nick">{t(locale, 'enterNickname')}</label>
          <input
            id="nick"
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, GAME_LIMITS.NICKNAME_MAX))}
            className="w-full rounded-2xl glass px-5 py-4 text-2xl outline-none focus:ring-2 focus:ring-brand-violet"
            placeholder={t(locale, 'enterNickname')}
            dir="auto"
          />
        </div>

        <div>
          <p className="mb-3 text-ink-secondary">{t(locale, 'chooseAvatar')}</p>
          <div className="grid grid-cols-4 gap-3">
            {AVATARS.map((a) => (
              <button
                key={a.id}
                onClick={() => { setAvatarId(a.id); haptic(8); }}
                className="grid place-items-center rounded-2xl p-1"
                aria-label={a.labelAr}
              >
                <Avatar avatarId={a.id} size={60} selected={a.id === avatarId} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {err && <p className="mt-4 text-center text-danger">{err}</p>}

      <div className="mt-auto pt-6">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleJoin}
          disabled={!validCode || !validName || busy}
          className="w-full rounded-2xl bg-gradient-brand py-5 font-display text-3xl font-bold shadow-glow transition disabled:opacity-40"
        >
          {busy ? t(locale, 'joining') : t(locale, 'join')}
        </motion.button>
      </div>
    </div>
  );
}

function waitForConnect(timeoutMs = 6000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (useStore.getState().conn === 'connected') return resolve();
      if (useStore.getState().conn === 'error') return reject(new Error(useStore.getState().errorCode ?? 'CONNECT_ERROR'));
      if (Date.now() - start > timeoutMs) return reject(new Error('UNKNOWN_ROOM'));
      setTimeout(tick, 100);
    };
    tick();
  });
}

function mapError(code: string, locale: 'ar' | 'en'): string {
  if (code === 'NICKNAME_TAKEN') return t(locale, 'nicknameTaken');
  if (code === 'ROOM_FULL') return t(locale, 'roomFull');
  if (code === 'UNKNOWN_ROOM' || code === 'CONNECT_ERROR') return t(locale, 'roomNotFound');
  return t(locale, 'error');
}
