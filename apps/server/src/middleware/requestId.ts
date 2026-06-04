/** Attach a correlation id to every request (logs + response meta). */
import type { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || nanoid(16);
  res.locals.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
