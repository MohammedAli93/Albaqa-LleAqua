/** Consistent REST response envelope helpers (doc 04 §1). */
import type { Response } from 'express';
import type { ApiErrorShape } from '@tahaddi/shared';

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({
    ok: true,
    data,
    meta: { requestId: res.locals.requestId as string | undefined },
  });
}

export function fail(res: Response, status: number, error: ApiErrorShape): Response {
  return res.status(status).json({
    ok: false,
    error,
    meta: { requestId: res.locals.requestId as string | undefined },
  });
}
