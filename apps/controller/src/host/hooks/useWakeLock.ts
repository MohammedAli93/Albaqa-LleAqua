/** Keep the host display awake during a game so the screen doesn't sleep and
 *  drop its connection (which would pause the game). Re-acquires on visibility. */
import { useEffect } from 'react';

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        /* unsupported / denied */
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
