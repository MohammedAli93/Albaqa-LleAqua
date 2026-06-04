/** Express application assembly. */
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { ALLOWED_ORIGINS } from './config/env.js';
import { logger } from './lib/logger.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { limiters } from './middleware/rateLimit.js';
import { authRouter } from './http/routes/auth.routes.js';
import { publicRouter } from './http/routes/public.routes.js';
import { adminRouter } from './http/routes/admin.routes.js';
import { adminExtraRouter } from './http/routes/adminExtra.routes.js';
import { paymentsRouter } from './http/routes/payments.routes.js';
import { fail } from './http/respond.js';
import { ErrorCode } from '@tahaddi/shared';
import { pingRedis } from './lib/redis.js';
import { prisma } from './lib/prisma.js';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1); // behind Railway/LB
  app.use(helmet());
  app.use(
    cors({
      origin: ALLOWED_ORIGINS,
      credentials: true,
    }),
  );
  app.use(requestId);
  app.use(pinoHttp({ logger, customProps: (_req, res) => ({ requestId: res.locals.requestId }) }));

  // Health checks (before body parsing & rate limits).
  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.get('/readyz', async (_req, res) => {
    const [redisOk, dbOk] = await Promise.all([
      pingRedis(),
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    ]);
    const ready = redisOk && dbOk;
    res.status(ready ? 200 : 503).json({ ok: ready, redis: redisOk, db: dbOk });
  });

  app.use(cookieParser());
  // Global 1MB JSON parser — except the bulk-import route which parses its own
  // (larger) body. Payment webhooks (Phase 8) also bypass this for raw-body sigs.
  const globalJson = express.json({ limit: '1mb' });
  app.use((req, res, next) =>
    req.path.endsWith('/import/preview') || req.path.startsWith('/api/v1/payments/webhook')
      ? next()
      : globalJson(req, res, next),
  );
  app.use('/api', limiters.global);

  // Routers
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1', publicRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/admin', adminExtraRouter);
  app.use('/api/v1/payments', paymentsRouter);

  app.use((_req, res) => fail(res, 404, { code: ErrorCode.NOT_FOUND, message: 'Not found' }));
  app.use(errorHandler);

  return app;
}
