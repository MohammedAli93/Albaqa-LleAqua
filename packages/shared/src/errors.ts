/**
 * Stable error codes shared by REST and WebSocket layers. Clients switch on
 * `code` (never on `message`, which may be localized).
 */

export const ErrorCode = {
  // generic
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA: 'UNSUPPORTED_MEDIA',
  INTERNAL: 'INTERNAL',
  // realtime / game
  UNKNOWN_ROOM: 'UNKNOWN_ROOM',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_CLOSED: 'ROOM_CLOSED',
  NICKNAME_TAKEN: 'NICKNAME_TAKEN',
  INVALID_STATE: 'INVALID_STATE',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  DUPLICATE_ANSWER: 'DUPLICATE_ANSWER',
  // payments
  PAYMENT_PROVIDER_UNSUPPORTED: 'PAYMENT_PROVIDER_UNSUPPORTED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  /** The host must buy the paid unlock before starting this game. */
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Default HTTP status for each code (REST layer). */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA: 415,
  INTERNAL: 500,
  UNKNOWN_ROOM: 404,
  ROOM_FULL: 409,
  ROOM_CLOSED: 409,
  NICKNAME_TAKEN: 409,
  INVALID_STATE: 409,
  NOT_AUTHORIZED: 403,
  DUPLICATE_ANSWER: 409,
  PAYMENT_PROVIDER_UNSUPPORTED: 400,
  PAYMENT_FAILED: 402,
  PAYMENT_REQUIRED: 402,
};

export interface ApiErrorShape {
  code: ErrorCode;
  message: string;
  details?: Array<{ path: string; issue: string }>;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta?: { requestId?: string };
}

export interface ApiFailure {
  ok: false;
  error: ApiErrorShape;
  meta?: { requestId?: string };
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/** Socket intent ack envelope (mirrors ApiResult). */
export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorShape };

/**
 * Application error carrying a stable code. Thrown anywhere in the server and
 * translated to the REST/WS envelope by the central handler.
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: Array<{ path: string; issue: string }>,
  ) {
    super(message ?? code);
    this.name = 'AppError';
  }

  get httpStatus(): number {
    return ERROR_HTTP_STATUS[this.code];
  }

  toShape(): ApiErrorShape {
    return { code: this.code, message: this.message, details: this.details };
  }
}
