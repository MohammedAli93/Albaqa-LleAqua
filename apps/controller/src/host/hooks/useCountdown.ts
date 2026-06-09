/** Smooth countdown: ticks every animation frame off the authoritative `endsAt`
 *  so the ring moves at 60fps even though the server only emits ~4 Hz. */
import { useEffect, useState } from 'react';

export function useCountdown(endsAt: number | null, active: boolean): number {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!endsAt || !active) {
      setRemaining(0);
      return;
    }
    let raf = 0;
    const loop = () => {
      setRemaining(Math.max(0, endsAt - Date.now()));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [endsAt, active]);
  return remaining;
}
