/** Central error translator → REST envelope. Last middleware in the chain. */
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ErrorCode, ERROR_HTTP_STATUS } from '@tahaddi/shared';
import { logger } from '../lib/logger.js';
import { fail } from '../http/respond.js';
import { captureError } from '../telemetry/sentry.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = res.locals.requestId as string | undefined;

  if (err instanceof AppError) {
    fail(res, err.httpStatus, err.toShape());
    return;
  }

  if (err instanceof ZodError) {
    fail(res, ERROR_HTTP_STATUS.VALIDATION_ERROR, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Validation failed',
      details: err.issues.map((i) => ({ path: i.path.join('.'), issue: i.message })),
    });
    return;
  }

  // Prisma unique-constraint → CONFLICT (defensive; most are caught in domain)
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
    fail(res, ERROR_HTTP_STATUS.CONFLICT, {
      code: ErrorCode.CONFLICT,
      message: 'Resource already exists',
    });
    return;
  }

  logger.error({ err, requestId, path: req.path }, 'unhandled error');
  captureError(err, { requestId, path: req.path });
  fail(res, 500, { code: ErrorCode.INTERNAL, message: 'Internal server error' });
}

/** Wrap async route handlers so thrown/rejected errors reach errorHandler. */
export function asyncHandler<
  H extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
>(handler: H) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
