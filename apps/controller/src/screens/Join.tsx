import { useState } from 'react';
import { AVATARS, GAME_LIMITS } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { connect, joinGame, getSocket } from '../socket.js';
import { Avatar } from '../components/Avatar.js';
import { haptic } from '../hooks/useDevice.js';
import {
  AuthShell, AuthCard, AuthField, CtaButton, authInputCls,
} from './app/AuthShell.js';

/**
 * Join-by-code — desert "Login" comp (Assets/Login screen 7): room code + name +
 * avatar grid inside the orange card. Presentation rebuilt; join logic unchanged.
 */
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
    <AuthShell
      onBrand={() => set({ appView: 'home' })}
      navAction={
        <button onClick={() => set({ appView: 'login' })} className="transition hover:opacity-80">
          تسجيل الدخول
        </button>
      }
    >
      <AuthCard>
        <div className="mt-6 space-y-4">
          <AuthField label={t(locale, 'enterRoomCode')}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, GAME_LIMITS.ROOM_CODE_LENGTH))}
              inputMode="text"
              autoCapitalize="characters"
              dir="ltr"
              className={`${authInputCls} text-center font-display text-2xl font-bold tracking-[0.4em]`}
              placeholder="------"
            />
          </AuthField>

          <AuthField label={t(locale, 'enterNickname')}>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, GAME_LIMITS.NICKNAME_MAX))}
              dir="auto"
              className={authInputCls}
            />
          </AuthField>

          <div>
            <p className="mb-2 text-right font-display font-bold text-white drop-shadow-sm">
              {t(locale, 'chooseAvatar')}
            </p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setAvatarId(a.id); haptic(8); }}
                  className="grid aspect-square place-items-center transition active:scale-90"
                  aria-label={a.labelAr}
                >
                  <Avatar avatarId={a.id} size={48} shape="square" selected={a.id === avatarId} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {err && <p className="mt-4 text-center font-bold text-[#B3160B]">{err}</p>}

        <div className="mt-7">
          <CtaButton variant="blue" onClick={handleJoin} disabled={!validCode || !validName || busy}>
            {busy ? t(locale, 'joining') : t(locale, 'join')}
          </CtaButton>
        </div>
      </AuthCard>
    </AuthShell>
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
