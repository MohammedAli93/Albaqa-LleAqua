/**
 * Socket handler wrapper. Guarantees: payload validated, errors converted to a
 * structured ack (never crash the namespace), basic per-socket flood control.
 */
import type { Socket } from 'socket.io';
import type { ZodTypeAny, infer as ZodInfer } from 'zod';
import { AppError, ErrorCode, type Ack } from '@tahaddi/shared';
import { logger } from '../lib/logger.js';
import { RATE_LIMITS } from '../config/limits.js';

type AckFn = (res: Ack<unknown>) => void;

function isAckFn(x: unknown): x is AckFn {
  return typeof x === 'function';
}

// Simple in-memory sliding counter per socket (flood guard; per-instance is fine
// because a socket lives on one instance).
const counters = new WeakMap<Socket, { windowStart: number; count: number }>();
function floodCheck(socket: Socket): boolean {
  const now = Date.now();
  const c = counters.get(socket) ?? { windowStart: now, count: 0 };
  if (now - c.windowStart >= 1000) {
    c.windowStart = now;
    c.count = 0;
  }
  c.count += 1;
  counters.set(socket, c);
  return c.count <= RATE_LIMITS.ws.eventsPerSec;
}

export function on<S extends ZodTypeAny, R>(
  socket: Socket,
  event: string,
  schema: S,
  handler: (input: ZodInfer<S>, socket: Socket) => Promise<R>,
): void {
  socket.on(event, async (rawPayload: unknown, maybeAck: unknown) => {
    const ack = isAckFn(maybeAck) ? maybeAck : undefined;

    if (!floodCheck(socket)) {
      ack?.({ ok: false, error: { code: ErrorCode.RATE_LIMITED, message: 'Slow down' } });
      return;
    }

    const parsed = schema.safeParse(rawPayload ?? {});
    if (!parsed.success) {
      ack?.({
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid payload',
          details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), issue: i.message })),
        },
      });
      return;
    }

    try {
      const data = await handler(parsed.data, socket);
      ack?.({ ok: true, data });
    } catch (err) {
      if (err instanceof AppError) {
        ack?.({ ok: false, error: err.toShape() });
      } else {
        logger.error({ err, event }, 'socket handler error');
        ack?.({ ok: false, error: { code: ErrorCode.INTERNAL, message: 'Internal error' } });
      }
    }
  });
}
