/**
 * Centralized rate-limit & abuse-control budgets (doc 08 §5). Enforced in Redis
 * so they hold across all replicas.
 */
export const RATE_LIMITS = {
  // REST (per IP, sliding window)
  rest: {
    global: { windowMs: 60_000, max: 300 },
    auth: { windowMs: 60_000, max: 10 }, // login/refresh
    roomCreate: { windowMs: 60_000, max: 20 },
    roomLookup: { windowMs: 60_000, max: 60 }, // GET /rooms/:code (enumeration guard)
    import: { windowMs: 60_000, max: 10 },
  },
  // WebSocket (per socket / per IP)
  ws: {
    connectPerIp: { windowMs: 60_000, max: 60 },
    joinPerIp: { windowMs: 60_000, max: 20 },
    answerPerRound: 1,
    heartbeatPerSec: 1,
    eventsPerSec: 20, // generic flood guard
  },
  // connection caps
  maxSocketsPerIp: 30,
  maxRoomsPerHost: 5,
} as const;
