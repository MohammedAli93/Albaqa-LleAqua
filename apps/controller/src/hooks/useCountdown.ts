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
