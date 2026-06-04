# 04 — REST API Specification

REST handles everything that is **not** the live game loop: auth, admin content
management, media, payments, and read-only public/lookup endpoints. The live game
runs over WebSockets (doc 05).

Base URL: `/api`  ·  Version prefix: `/api/v1`  ·  Format: JSON  ·  Auth: Bearer JWT.

## 1. Conventions

### Response envelope
Every response uses a consistent envelope so clients have one parsing path.

**Success**
```json
{ "ok": true, "data": { /* payload */ }, "meta": { "requestId": "..." } }
```

**Error**
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable, localized when possible",
    "details": [{ "path": "email", "issue": "invalid" }]
  },
  "meta": { "requestId": "..." }
}
```

### Error codes (stable, shared in `packages/shared/errors.ts`)
`VALIDATION_ERROR` (400) · `UNAUTHENTICATED` (401) · `FORBIDDEN` (403) ·
`NOT_FOUND` (404) · `CONFLICT` (409) · `RATE_LIMITED` (429) ·
`PAYLOAD_TOO_LARGE` (413) · `UNSUPPORTED_MEDIA` (415) · `INTERNAL` (500).

### Auth
- `Authorization: Bearer <accessToken>` (JWT, 15 min TTL).
- Refresh via httpOnly secure cookie `rt` (7 day TTL, rotating).
- `tokenVersion` claim; bumping the user's version revokes all tokens.

### Pagination
Cursor-based: `?cursor=<id>&limit=<n≤100>` → `data.items[]` + `data.nextCursor`.

### Idempotency
Mutating admin/payment POSTs accept `Idempotency-Key` header; replays return the
original result.

---

## 2. Auth & session

| Method | Path | Auth | Body / Notes |
|--------|------|------|--------------|
| POST | `/v1/auth/login` | public | `{email, password}` → `{accessToken, user}` + sets `rt` cookie. Rate-limited, lockout after 5 fails. |
| POST | `/v1/auth/refresh` | cookie | rotates refresh token → new access token. |
| POST | `/v1/auth/logout` | bearer | invalidates refresh cookie. |
| GET  | `/v1/auth/me` | bearer | current user profile + role. |
| POST | `/v1/auth/password` | bearer | `{currentPassword, newPassword}` bumps `tokenVersion`. |

---

## 3. Public / lobby (host & player provisioning)

These create the bridge between REST (room creation) and WS (gameplay). The host
creates a room over REST, receives a `hostToken`; players validate a room code
before opening the socket.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/v1/rooms` | host bootstrap | `{packageId, mode, settings}` → `{roomCode, hostToken, socketUrl}`. Generates room, registers in Redis. |
| GET  | `/v1/rooms/:code` | public | Lightweight lobby info `{exists, status, mode, playerCount, packageTitle}` for the join screen (no secrets). 429-guarded against code enumeration. |
| GET  | `/v1/packages/public` | public | Published packages for host package picker. |
| GET  | `/v1/avatars` | public | Built-in avatar catalogue (served from `packages/shared`). |

> The host's authoritative actions (start game, next round, kick) happen over the
> socket, authorized by `hostToken`. REST only bootstraps the room.

---

## 4. Admin — content

All under `/v1/admin/*`, require bearer + role. Role matrix in doc 08.

### Categories
| Method | Path | Role |
|--------|------|------|
| GET | `/v1/admin/categories` | VIEWER+ |
| POST | `/v1/admin/categories` | EDITOR+ |
| PATCH | `/v1/admin/categories/:id` | EDITOR+ |
| DELETE | `/v1/admin/categories/:id` | ADMIN+ (soft delete) |

### Questions
| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/v1/admin/questions` | VIEWER+ | filters: `categoryId, type, difficulty, q, isApproved`; paginated. |
| GET | `/v1/admin/questions/:id` | VIEWER+ | |
| POST | `/v1/admin/questions` | EDITOR+ | Zod-validated; options shape enforced; correctOptionId ∈ options. |
| PATCH | `/v1/admin/questions/:id` | EDITOR+ | |
| DELETE | `/v1/admin/questions/:id` | ADMIN+ | soft delete. |
| POST | `/v1/admin/questions/:id/approve` | ADMIN+ | toggles `isApproved`. |

### Bulk import
| Method | Path | Role | Notes |
|--------|------|------|-------|
| POST | `/v1/admin/questions/import/preview` | EDITOR+ | multipart CSV/XLSX → parsed rows + per-row validation report (no writes). |
| POST | `/v1/admin/questions/import/commit` | EDITOR+ | `{importId}` from preview → transactional insert; returns created/failed counts. |

**Import column contract** (CSV/XLSX header row):
`type, difficulty, categorySlug, promptAr, promptEn, optionA_ar, optionA_en,
optionB_ar, optionB_en, optionC_ar, optionC_en, optionD_ar, optionD_en,
correct (A|B|C|D), timeLimitSec, basePoints, explanationAr, explanationEn, tags`

Preview validates: category exists, exactly one correct option, non-empty Arabic
prompt, numeric bounds. Errors are returned per-row with a line number so the
operator fixes the file and re-uploads.

### Packages
| Method | Path | Role |
|--------|------|------|
| GET / POST | `/v1/admin/packages` | VIEWER+ / EDITOR+ |
| PATCH / DELETE | `/v1/admin/packages/:id` | EDITOR+ / ADMIN+ |
| PUT | `/v1/admin/packages/:id/questions` | EDITOR+ — set ordered question list `[{questionId, order}]` |
| POST | `/v1/admin/packages/:id/publish` | ADMIN+ |

---

## 5. Admin — media

| Method | Path | Role | Notes |
|--------|------|------|-------|
| POST | `/v1/admin/media/sign-upload` | EDITOR+ | `{type, mimeType, sizeBytes}` → presigned S3 PUT URL + `mediaId` (status PENDING). Validates mime allowlist & size cap (img 8MB, audio 20MB, video 200MB). |
| POST | `/v1/admin/media/:id/complete` | EDITOR+ | client confirms upload; server HEADs object, extracts metadata, sets READY. |
| GET | `/v1/admin/media` | VIEWER+ | browse asset library, paginated. |
| DELETE | `/v1/admin/media/:id` | ADMIN+ | removes object if unreferenced. |

Direct-to-S3 presigned uploads keep large media off the API process.

---

## 6. Admin — analytics & sessions

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/v1/admin/analytics/overview` | VIEWER+ | KPIs: games played, unique players, avg duration, completion rate (date range). |
| GET | `/v1/admin/analytics/questions` | VIEWER+ | hardest/easiest, usage, correctRate. |
| GET | `/v1/admin/sessions` | VIEWER+ | finished games list, paginated, filters. |
| GET | `/v1/admin/sessions/:gameId` | VIEWER+ | full replay summary: rounds, answers, leaderboard. |
| GET | `/v1/admin/revenue/overview` | ADMIN+ | orders, revenue by package/provider/currency. |

---

## 7. Admin — users (SUPER_ADMIN)

| Method | Path | Role |
|--------|------|------|
| GET / POST | `/v1/admin/users` | SUPER_ADMIN |
| PATCH | `/v1/admin/users/:id` | SUPER_ADMIN (role, isActive) |
| POST | `/v1/admin/users/:id/revoke-tokens` | SUPER_ADMIN (bumps tokenVersion) |
| GET | `/v1/admin/audit` | ADMIN+ (filter by actor/entity/date) |

---

## 8. Payments

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/v1/payments/checkout` | optional | `{packageId, provider}` → provider-specific `{clientSecret|redirectUrl|...}`. Creates `Order(PENDING)`. |
| POST | `/v1/payments/webhook/:provider` | provider signature | Verifies signature, idempotent via `WebhookEvent`, transitions Order/Payment. **Raw body** preserved for signature checks. |
| GET | `/v1/payments/orders/:id` | bearer/owner | order status polling. |

Details of the provider abstraction in doc 10.

---

## 9. Ops

| Method | Path | Notes |
|--------|------|-------|
| GET | `/healthz` | liveness (process up). |
| GET | `/readyz` | readiness (DB + Redis reachable). |
| GET | `/metrics` | Prometheus/OTel metrics (internal network only). |

---

## 10. Validation strategy

- Every endpoint has a Zod schema for params/query/body, defined once and shared
  with the client where the shape is shared (`packages/shared/rest.ts`).
- A single `validate(schema)` middleware parses and replaces `req.input`; handlers
  receive already-typed, trusted data.
- File uploads validated by declared metadata first (cheap reject), then by S3
  object HEAD on completion (truth).
