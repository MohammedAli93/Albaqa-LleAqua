/**
 * Server bootstrap: HTTP + Socket.IO, with graceful shutdown.
 * The realtime layer (Phase 4) attaches to the same HTTP server.
 */
import { createServer } from 'node:http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { createApp } from './app.js';
import { disconnectPrisma } from './lib/prisma.js';
import { disconnectRedis } from './lib/redis.js';
import { attachRealtime, shutdownRealtime } from './realtime/index.js';
import { initSentry } from './telemetry/sentry.js';
import { initOtel } from './telemetry/otel.js';

async function main(): Promise<void> {
  // Observability first, so it captures startup issues too.
  await initOtel();
  initSentry();

  const app = createApp();
  const httpServer = createServer(app);

  // Attach Socket.IO realtime layer.
  await attachRealtime(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`🚀 Tahaddi server listening on :${env.PORT} (${env.NODE_ENV})`);
  });

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received — shutting down gracefully`);

    // Stop accepting new connections.
    httpServer.close();
    await shutdownRealtime();
    await Promise.allSettled([disconnectRedis(), disconnectPrisma()]);
    logger.info('shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException');
    process.exit(1);
  });
}

void main();
