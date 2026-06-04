/**
 * Per-instance round timer scheduler. Holds in-memory timeouts keyed by gameId.
 * Because the authoritative deadline (`endsAt`) is stored in Redis, timers can be
 * rehydrated after a restart/failover (doc 06 §2.4) — `rearmFromState` recomputes
 * the remaining time from the absolute deadline.
 */
type Callback = () => void | Promise<void>;

const timers = new Map<string, NodeJS.Timeout>();

export function scheduleRoundEnd(gameId: string, endsAt: number, cb: Callback): void {
  clearRoundTimer(gameId);
  const delay = Math.max(0, endsAt - Date.now());
  timers.set(
    gameId,
    setTimeout(() => {
      timers.delete(gameId);
      void cb();
    }, delay),
  );
}

export function clearRoundTimer(gameId: string): void {
  const t = timers.get(gameId);
  if (t) {
    clearTimeout(t);
    timers.delete(gameId);
  }
}

export function hasTimer(gameId: string): boolean {
  return timers.has(gameId);
}

export function clearAllTimers(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  for (const i of tickers.values()) clearInterval(i);
  tickers.clear();
}

// ── Countdown tick broadcaster (≈4 Hz; clients tween to 60fps) ────────────────
const tickers = new Map<string, NodeJS.Timeout>();

export function scheduleTicks(
  gameId: string,
  endsAt: number,
  onTick: (remainingMs: number) => void,
  intervalMs = 250,
): void {
  clearTicks(gameId);
  tickers.set(
    gameId,
    setInterval(() => {
      const remaining = Math.max(0, endsAt - Date.now());
      onTick(remaining);
      if (remaining <= 0) clearTicks(gameId);
    }, intervalMs),
  );
}

export function clearTicks(gameId: string): void {
  const i = tickers.get(gameId);
  if (i) {
    clearInterval(i);
    tickers.delete(gameId);
  }
}
