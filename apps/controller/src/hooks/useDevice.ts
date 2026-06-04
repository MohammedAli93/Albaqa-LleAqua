/** Haptics + screen wake-lock for a better in-hand game feel. */
import { useEffect } from 'react';

export function haptic(pattern: number | number[] = 12): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}

/** Keep the screen awake during a game so it doesn't sleep mid-question. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        /* unsupported */
      }
    };
    void request();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !released) void request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
