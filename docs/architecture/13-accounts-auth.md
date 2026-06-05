# 13. Player Accounts & Registration (البقاء للأقوى)

Persistent player identity — separate from the admin `User` (RBAC) table. Unlocks
both the **profile stats** the client wants (points/elimination wins) and
**monetization** (a wallet/entitlements need an identity; see [12](./12-entitlements.md)).

> **Revision 2026-06-05:** Phone-OTP login was replaced by a plain registration
> form — **username + email + mobile** (all required & validated, all unique), no
> OTP/password. The mobile number is the unique identity used to log back in.
> Endpoints: `POST /player/auth/register`, `POST /player/auth/login` (by mobile),
> `GET/PATCH /player/me`. The `PlayerOtp` model and OTP code paths were removed.
> The OTP-specific prose below is retained only for historical context.

## Why phone-OTP
Gulf market is phone-first; no passwords to forget, and a verified phone is the
natural **anti-abuse key** for "first game free" (one free game per phone).

## Data model (Prisma)
- `Player` — `phone` (unique), `phoneVerified`, `displayName`, `country`,
  `avatarId`, and stats `leagueWins` / `cupWins` / `gamesPlayed`. Owns
  `Wallet` (1:1), `GamePass[]`, `Order[]`, and `Participant[]` (games played).
  Country indexes (`[country, leagueWins]`, `[country, cupWins]`) back the
  per-country leaderboards.
- `PlayerOtp` — hashed one-time code (`codeHash`, never the raw code), `expiresAt`,
  `attempts`, `consumedAt`.
- `Participant.playerId` — links an in-game seat to an account (null for guests).

## OTP flow
```
POST /api/v1/auth/otp/request  { phone }
  → normalizePhone → canResend? (60s cooldown)
  → generate 6-digit code, hash it (token scheme), store PlayerOtp(expires +5m)
  → SMS the raw code (provider: Unifonic / Twilio / Taqnyat for KSA)

POST /api/v1/auth/otp/verify   { phone, code, displayName?, country? }
  → load latest PlayerOtp(phone) → verifyOtp(rec, hash(code), now)
      EXPIRED | CONSUMED | LOCKED | MISMATCH → 4xx (bump attempts on mismatch)
  → ok: mark consumed, upsert Player(phone, phoneVerified=true), set name/country
        on first login, issue a Player JWT (access + refresh)
```
The verification rules (expiry, max-attempts lock, consumed, cooldown) are the
pure, unit-tested `domain/auth/otp.ts` (`verifyOtp`, `canResend`, `normalizePhone`).
Code generation, hashing and SMS are I/O in the service layer.

## Session on the controller
The controller stores the Player JWT and presents it in the `/play` handshake
(`auth.playerToken`). When present, the server attaches `playerId` to the
`Participant` (instead of an anonymous nickname). Guests can still play nameless;
only logged-in players accrue stats and can host paid games.

## Country selection
On first verify (or in profile), the player picks a country from the launch set
(KSA, KW, BH, QA, AE, OM, YE, SY, JO, LB, EG, TN, DZ, MA). Stored on `Player.country`
and used to scope leaderboards. (Open question with client: country affects
*rankings* only, or also filters questions — assumed rankings.)

## Profile stats (league/cup wins)
On game completion, if the winner's `Participant.playerId` is set:
- `gamesPlayed += 1` for every linked participant,
- `leagueWins += 1` if `Game.mode = LEAGUE`,
- `cupWins += 1` if `Game.mode = CUP`.
Done in the same transaction that writes `GameResult` (the engine's `completeGame`),
so stats can never drift from results. Profile endpoint reads straight off `Player`.

## Security
- Codes hashed at rest; raw code only in transit (SMS).
- Max 5 attempts → lock; 60s resend cooldown; rate-limit the request endpoint per
  phone + per IP.
- Player JWTs separate from admin JWTs (different secret/audience).

## Build order
1. `Player` + `PlayerOtp` schema (done) + OTP pure core (done).
2. Auth service (generate/hash/SMS) + REST endpoints + Player JWT.
3. Controller login UI (phone → code → name/country) + token storage.
4. Link `Participant.playerId` in `/play`; increment stats in `completeGame`.
5. Profile screen + (next doc) country leaderboards.
