# 08 — Security Architecture

Threat model spans three surfaces: the **public join flow** (untrusted players),
the **admin panel** (privileged operators), and **payments** (money + PII). The
guiding rule everywhere: **never trust the client**.

## 1. Authentication

### Admin / operators (JWT)
- Password hashing: **argon2id** (memory-hard) with per-user salt.
- Login returns a 15-min **access token** (JWT, signed HS256/asymmetric RS256 in
  prod) + a rotating **refresh token** in an `httpOnly`, `Secure`, `SameSite=Strict`
  cookie (7-day TTL).
- JWT claims: `sub`, `role`, `tokenVersion`, `iat`, `exp`. Bumping a user's
  `tokenVersion` (password change, forced logout, role change) invalidates every
  outstanding token immediately.
- Account lockout: 5 failed logins → temporary `lockedUntil` with exponential
  backoff; failures logged to audit.

### Players (capability tokens, not accounts)
- Players are anonymous. On `player:join` the server issues a random 256-bit
  `sessionToken`; only its hash is stored. It authorizes exactly one participant in
  one room and nothing else. This is a **capability**, not an identity — minimal
  attack surface, nothing to steal of value.
- Host gets a `hostToken` capability the same way (room creation).

## 2. Authorization (RBAC)

Role hierarchy: `SUPER_ADMIN > ADMIN > EDITOR > VIEWER`.

| Capability | VIEWER | EDITOR | ADMIN | SUPER_ADMIN |
|------------|:------:|:------:|:-----:|:-----------:|
| Read content & analytics | ✓ | ✓ | ✓ | ✓ |
| Create/edit questions, packages, media | | ✓ | ✓ | ✓ |
| Delete content, approve, publish | | | ✓ | ✓ |
| View revenue | | | ✓ | ✓ |
| Manage users & roles, revoke tokens | | | | ✓ |
| Terminate live rooms (moderation) | | | ✓ | ✓ |

Enforced by a `requireRole(min)` middleware on REST and a namespace guard on WS.
Authorization is checked **server-side on every request** — the admin UI hiding a
button is convenience, never a control.

## 3. Input validation

- **Zod at every boundary** — REST bodies/params/queries and every WS payload.
  Parsed input replaces raw input; handlers never see unvalidated data.
- Strict bounds: nickname `2..20` chars + profanity/Unicode-confusable filter;
  option counts; numeric ranges (timer, points); enum membership.
- **Output encoding** — all user-supplied strings (nicknames, team names) rendered
  as text (React escapes by default); no `dangerouslySetInnerHTML` on user data.
- File uploads: mime allowlist + size caps declared up front and **re-verified**
  against the stored object (magic-byte / HEAD check) before marking READY.

## 4. Anti-cheat (game integrity)

The realtime game is the juiciest cheat target. Defenses:

| Cheat vector | Defense |
|--------------|---------|
| Submitting an answer after seeing the correct one | `correctOptionId` is **never sent** to clients until `question:reveal`, *after* the collection window closes. Impossible to know the answer in time. |
| Editing score/lives client-side | Score/lives are server-only; client values are display caches overwritten by `score:update`. Tampering changes nothing authoritative. |
| Replaying / spoofing another player | Answer must come from the socket bound to that participant's `sessionToken`; cross-participant submits rejected `NOT_AUTHORIZED`. |
| Answering twice / spamming to brute-force timing | One answer per round enforced by Redis lock + PG `@@unique([roundId, participantId])`; duplicates idempotently return the first result. |
| Faking ultra-fast `clientTs` for speed bonus | Speed bonus uses **server-measured** `responseMs` (server receive time − round start), not client-claimed timestamps. |
| Answering before the question is "shown" | FSM rejects `player:answer` unless state == COLLECTING for the *current* `roundId`. |
| Bot flooding joins to fill/deny rooms | Per-IP join rate limit, room capacity cap, host-visible kick, optional lightweight challenge. |
| Code enumeration to find/raid rooms | 6-char codes from a 32-symbol alphabet (~1.07e9 space), short-lived, `GET /rooms/:code` rate-limited and returns minimal info; brute-forcing is throttled to uselessness. |

## 5. Rate limiting & abuse control

- **REST** — sliding-window limiter (Redis token bucket) per IP + per user; stricter
  on auth (`/auth/login`), room creation, and import endpoints.
- **WebSocket** — per-socket event budgets: `player:answer` ≤ 1 per round,
  `player:heartbeat` ≤ 1 / 5s, join attempts ≤ N/min per IP. Exceeding budgets →
  `RATE_LIMITED` ack, then disconnect on egregious abuse.
- **Connection** — max sockets per IP; max rooms per host token.
- Limits are centralized in `config/limits.ts` and enforced in Redis so they hold
  across all replicas.

## 6. Session & transport security

- TLS everywhere (HSTS); secure cookies; WSS only.
- **CORS** allowlist of the three app origins; credentials only where needed.
- **CSP** on all apps: restrict script/style/connect/img/media sources; no inline
  scripts (nonce-based where unavoidable).
- Standard headers via Helmet: `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy`.
- Access tokens kept **in memory** on the admin client (not localStorage) to reduce
  XSS token theft; refresh handled by the httpOnly cookie.

## 7. Payments security

- No raw card data ever touches our servers — provider SDKs/Elements tokenize
  client-side; we store only provider references.
- **Webhooks**: verify provider signature against the **raw** request body; reject
  unsigned/invalid; idempotency via `WebhookEvent @@unique([provider, eventId])` so
  retries don't double-grant.
- PII minimization: store only what's needed for fulfillment; redact provider
  payloads before persisting.

## 8. Audit logging

- Every privileged admin mutation writes an `AdminAuditLog` row: actor, action,
  entity, before/after diff, IP, user-agent, timestamp.
- Auth events (login success/fail, lockout, token revoke, role change) audited.
- Room moderation (kick, terminate) audited.
- Audit log is **append-only** at the application layer; retained ≥ 1 year; visible
  to ADMIN+ for forensics. Tamper-resistance via write-only DB role for app.

## 9. Secrets & dependency hygiene

- Secrets only via env/secret store; `.gitignore` covers `.env*`; pre-commit secret
  scan.
- Dependencies pinned + `pnpm audit` in CI; Dependabot/renovate for updates.
- Principle of least privilege for DB roles (app role can't `DROP`), S3 keys
  scoped to the media bucket, Redis password-protected and network-restricted.

## 10. Defense-in-depth summary

No single control is load-bearing. Anti-cheat relies on *both* withholding the
answer *and* server-side scoring *and* uniqueness constraints. Auth relies on
*both* short token TTL *and* `tokenVersion` revocation. This layering means one
bug or bypass does not collapse the whole system.
