/**
 * Validation middleware. Parses body/query/params with a Zod schema and replaces
 * the raw input on `req` with the typed, trusted result. Handlers then read from
 * `req.valid` and never touch unvalidated data.
 */
import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny, infer as ZodInfer } from 'zod';

type Source = 'body' | 'query' | 'params';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      valid: Record<string, unknown>;
    }
  }
}

export function validate(schema: ZodTypeAny, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.valid = { ...(req.valid ?? {}), [source]: result.data };
    next();
  };
}

/** Typed accessor for validated input. */
export function valid<S extends ZodTypeAny>(req: Request, source: Source = 'body'): ZodInfer<S> {
  return req.valid[source] as ZodInfer<S>;
}
