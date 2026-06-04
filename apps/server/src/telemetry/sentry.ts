/** Sentry error capture (server). No-op unless SENTRY_DSN is configured. */
import * as Sentry from '@sentry/node';
import { env, isProd } from '../config/env.js';
import { logger } from '../lib/logger.js';

let enabled = false;

export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    logger.debug('Sentry disabled (no DSN)');
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: isProd ? 0.1 : 1.0,
    release: process.env.GIT_SHA,
  });
  enabled = true;
  logger.info('Sentry initialized');
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
