/** Structured logging (pino). JSON in prod, pretty in dev. */
import { pino } from 'pino';
import { env, isProd } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: env.OTEL_SERVICE_NAME },
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname,service' },
        },
      }),
});

export type Logger = typeof logger;
