/**
 * Server-clock sync.
 *
 * The 3-2-1 pre-roll and the answer timer are driven off absolute server
 * timestamps (`startsAt` / `endsAt`). Without sync each device compares those to
 * its OWN wall clock — so a TV whose clock runs a second ahead of a phone flips
 * to the question a second early. That is the "question shows on the screen
 * before the mobile" bug.
 *
 * We measure the offset to the server once per connection (best of a few
 * RTT-compensated samples) and expose `serverNow()` = local clock + offset. Every
 * surface that counts down uses `serverNow()`, so the reveal lands at the same
 * true instant on every device regardless of how wrong each local clock is.
 */
import type { Socket } from 'socket.io-client';
import { ClientEvent } from '@tahaddi/shared';

let offset = 0; // serverTime - localTime (ms)

/** Current time on the server's clock (local clock corrected by the measured offset). */
export function serverNow(): number {
  return Date.now() + offset;
}

type SyncAck = { ok?: boolean; data?: { serverTime?: number } } | undefined;

/**
 * Fire a short burst of time:sync pings and keep the offset from the lowest-RTT
 * sample (the least network-jittered, so the most accurate). Safe to call on
 * every (re)connect — it just refreshes the offset.
 */
export function syncClock(socket: Socket, samples = 5): void {
  let best = Number.POSITIVE_INFINITY;
  let remaining = samples;

  const ping = (): void => {
    if (remaining-- <= 0) return;
    const t0 = Date.now();
    socket.emit(ClientEvent.TIME_SYNC, {}, (res: SyncAck) => {
      const serverTime = res?.data?.serverTime;
      if (typeof serverTime === 'number') {
        const t1 = Date.now();
        const rtt = t1 - t0;
        if (rtt < best) {
          best = rtt;
          // Server's clock at t1 ≈ serverTime + rtt/2 (assume symmetric latency).
          offset = serverTime + rtt / 2 - t1;
        }
      }
      if (remaining > 0) setTimeout(ping, 150);
    });
  };

  ping();
}
