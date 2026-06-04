# 02 — Database Schema

PostgreSQL via Prisma. This document defines the durable schema. Ephemeral live
game state lives in Redis (doc 06) and only the **final, reconciled** results are
written to Postgres.

## 1. Design principles

- **UUID v7-style** ids (`@default(uuid())` for MVP; ordered ULIDs noted as an
  upgrade) for non-guessable, shardable keys.
- **Soft delete** (`deletedAt`) on content tables so question packages already
  used in past games are never hard-removed (referential history).
- **JSONB** for genuinely variable shapes (question `options`, settings) but
  **never** for anything we filter/aggregate on heavily.
- **Money in integer minor units** (`amountMinor` + `currency`) — never floats.
- **Enums** for closed sets (roles, statuses, modes) → DB-level integrity.
- **Every FK indexed**; analytics queries get covering composite indexes.
- All timestamps `@db.Timestamptz`, UTC. Created/updated audit columns everywhere.

## 2. Entity-relationship (logical)

```
User ──< AdminAuditLog
User ──< Package (createdBy)
Category ──< Question
Package ──< PackageQuestion >── Question        (ordered many-to-many)
Package ──< Game
Question ──< MediaAsset (prompt/option media)   (optional)
Game ──< Participant ──< Answer >── Question
Game ──< Round ──< Answer
Game ──< Team ──< Participant
Tournament ──< Game
Game ──1 GameResult (denormalized summary)
Order ──< Payment ; Order >── Package ; Order >── User
WebhookEvent (idempotency for payment providers)
```

## 3. Prisma schema (authoritative draft)

> This is the schema we will materialize in Phase 2 (`prisma/schema.prisma`).
> Reproduced here so the data model is reviewable before any code.

```prisma
// ---------- Identity & Admin ----------

enum UserRole {
  SUPER_ADMIN   // full control incl. user & revenue management
  ADMIN         // content + analytics
  EDITOR        // content CRUD only
  VIEWER        // read-only dashboards
}

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  displayName   String
  role          UserRole @default(EDITOR)
  isActive      Boolean  @default(true)
  lastLoginAt   DateTime? @db.Timestamptz
  // security
  failedLogins  Int      @default(0)
  lockedUntil   DateTime? @db.Timestamptz
  tokenVersion  Int      @default(0)   // bump to invalidate all JWTs

  packages      Package[]      @relation("PackageAuthor")
  auditLogs     AdminAuditLog[]
  createdAt     DateTime @default(now()) @db.Timestamptz
  updatedAt     DateTime @updatedAt @db.Timestamptz

  @@index([role, isActive])
}

model AdminAuditLog {
  id         String   @id @default(uuid())
  actorId    String
  actor      User     @relation(fields: [actorId], references: [id])
  action     String                 // e.g. "question.create", "user.role.update"
  entityType String
  entityId   String?
  metadata   Json?                  // before/after diff, request ip, ua
  ip         String?
  createdAt  DateTime @default(now()) @db.Timestamptz

  @@index([actorId, createdAt])
  @@index([entityType, entityId])
}

// ---------- Content ----------

enum QuestionType {
  MULTIPLE_CHOICE
  TRUE_FALSE
  IMAGE          // media-backed prompt, MCQ answers
  AUDIO
  VIDEO
}

enum Difficulty { EASY MEDIUM HARD EXPERT }

model Category {
  id          String   @id @default(uuid())
  slug        String   @unique
  nameAr      String
  nameEn      String
  color       String   @default("#6D28D9")
  icon        String?
  sortOrder   Int      @default(0)
  questions   Question[]
  deletedAt   DateTime? @db.Timestamptz
  createdAt   DateTime @default(now()) @db.Timestamptz
  updatedAt   DateTime @updatedAt @db.Timestamptz
}

model Question {
  id            String       @id @default(uuid())
  type          QuestionType @default(MULTIPLE_CHOICE)
  difficulty    Difficulty   @default(MEDIUM)
  categoryId    String
  category      Category     @relation(fields: [categoryId], references: [id])

  // Bilingual content
  promptAr      String
  promptEn      String?
  explanationAr String?
  explanationEn String?

  // options: [{ id, textAr, textEn, mediaId? }]  — validated by Zod, shape stable
  options       Json
  correctOptionId String

  timeLimitSec  Int          @default(15)
  basePoints    Int          @default(100)
  speedBonus    Boolean      @default(true)

  // media (prompt-level); option-level media referenced inside options JSON
  promptMediaId String?
  promptMedia   MediaAsset?  @relation("QuestionPromptMedia", fields: [promptMediaId], references: [id])

  tags          String[]
  usageCount    Int          @default(0)   // analytics: how often served
  correctRate   Float?                     // rolling % answered correctly
  isApproved    Boolean      @default(false)

  packageLinks  PackageQuestion[]
  answers       Answer[]
  deletedAt     DateTime? @db.Timestamptz
  createdAt     DateTime @default(now()) @db.Timestamptz
  updatedAt     DateTime @updatedAt @db.Timestamptz

  @@index([categoryId, difficulty])
  @@index([type, isApproved])
}

model Package {
  id          String   @id @default(uuid())
  slug        String   @unique
  titleAr     String
  titleEn     String?
  descAr      String?
  descEn      String?
  coverMediaId String?
  coverMedia  MediaAsset? @relation("PackageCover", fields: [coverMediaId], references: [id])

  isPublished Boolean  @default(false)
  isPremium   Boolean  @default(false)   // requires purchase
  priceMinor  Int      @default(0)
  currency    String   @default("SAR")

  createdById String
  createdBy   User     @relation("PackageAuthor", fields: [createdById], references: [id])

  questions   PackageQuestion[]
  games       Game[]
  orders      Order[]
  deletedAt   DateTime? @db.Timestamptz
  createdAt   DateTime @default(now()) @db.Timestamptz
  updatedAt   DateTime @updatedAt @db.Timestamptz

  @@index([isPublished, isPremium])
}

model PackageQuestion {
  packageId  String
  questionId String
  order      Int
  package    Package  @relation(fields: [packageId], references: [id], onDelete: Cascade)
  question   Question @relation(fields: [questionId], references: [id])

  @@id([packageId, questionId])
  @@index([packageId, order])
}

enum MediaType { IMAGE AUDIO VIDEO }
enum MediaStatus { PENDING READY FAILED }

model MediaAsset {
  id          String      @id @default(uuid())
  type        MediaType
  status      MediaStatus @default(PENDING)
  storageKey  String      @unique          // S3 object key
  url         String?                       // CDN/public URL once READY
  mimeType    String
  sizeBytes   Int?
  width       Int?
  height      Int?
  durationSec Float?
  checksum    String?                       // dedupe + integrity
  uploadedById String?

  questionPrompts Question[] @relation("QuestionPromptMedia")
  packageCovers   Package[]  @relation("PackageCover")
  createdAt   DateTime @default(now()) @db.Timestamptz

  @@index([type, status])
}

// ---------- Live game (durable summary; live state is in Redis) ----------

enum GameMode { INDIVIDUAL TEAMS SUDDEN_DEATH TOURNAMENT }
enum GameStatus { LOBBY ACTIVE PAUSED COMPLETED ABANDONED }

model Game {
  id            String     @id @default(uuid())
  roomCode      String     @unique            // 6-char, recycled after completion
  mode          GameMode   @default(INDIVIDUAL)
  status        GameStatus @default(LOBBY)

  packageId     String
  package       Package    @relation(fields: [packageId], references: [id])
  tournamentId  String?
  tournament    Tournament? @relation(fields: [tournamentId], references: [id])

  // settings snapshot (timer, lives, scoring, maxPlayers) frozen at start
  settings      Json
  hostToken     String                         // hashed; authorizes host actions

  startedAt     DateTime? @db.Timestamptz
  endedAt       DateTime? @db.Timestamptz
  createdAt     DateTime @default(now()) @db.Timestamptz

  participants  Participant[]
  teams         Team[]
  rounds        Round[]
  answers       Answer[]
  result        GameResult?

  @@index([status, createdAt])
  @@index([tournamentId])
}

enum ParticipantStatus { ACTIVE ELIMINATED DISCONNECTED LEFT WINNER }

model Participant {
  id           String   @id @default(uuid())
  gameId       String
  game         Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  teamId       String?
  team         Team?    @relation(fields: [teamId], references: [id])

  nickname     String
  avatarId     String                          // references a built-in avatar set
  status       ParticipantStatus @default(ACTIVE)
  score        Int      @default(0)
  lives        Int      @default(1)
  joinOrder    Int
  eliminatedRound Int?

  // reconnection identity (hashed secret stored, raw given to client once)
  sessionToken String   @unique
  answers      Answer[]
  createdAt    DateTime @default(now()) @db.Timestamptz

  @@unique([gameId, nickname])
  @@index([gameId, status])
}

model Team {
  id          String   @id @default(uuid())
  gameId      String
  game        Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  name        String
  color       String
  score       Int      @default(0)
  members     Participant[]

  @@unique([gameId, name])
}

model Round {
  id            String   @id @default(uuid())
  gameId        String
  game          Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  index         Int                            // 0-based order within game
  questionId    String
  startedAt     DateTime @db.Timestamptz
  endedAt       DateTime? @db.Timestamptz
  correctOptionId String
  answers       Answer[]

  @@unique([gameId, index])
}

model Answer {
  id             String   @id @default(uuid())
  gameId         String
  game           Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  roundId        String
  round          Round    @relation(fields: [roundId], references: [id], onDelete: Cascade)
  participantId  String
  participant    Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  questionId     String
  question       Question @relation(fields: [questionId], references: [id])

  selectedOptionId String?                     // null = no answer (timeout)
  isCorrect      Boolean
  responseMs     Int                           // server-measured latency
  pointsAwarded  Int      @default(0)
  createdAt      DateTime @default(now()) @db.Timestamptz

  @@unique([roundId, participantId])           // hard dedupe: one answer per round
  @@index([gameId, participantId])
}

model GameResult {
  id            String   @id @default(uuid())
  gameId        String   @unique
  game          Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  winnerParticipantId String?
  winnerTeamId  String?
  totalPlayers  Int
  totalRounds   Int
  durationSec   Int
  // full ranked leaderboard snapshot for fast history rendering
  leaderboard   Json
  createdAt     DateTime @default(now()) @db.Timestamptz
}

model Tournament {
  id          String   @id @default(uuid())
  name        String
  status      GameStatus @default(LOBBY)
  bracket     Json?                            // bracket structure
  games       Game[]
  createdAt   DateTime @default(now()) @db.Timestamptz
}

// ---------- Payments (see doc 10) ----------

enum OrderStatus { PENDING PAID FAILED REFUNDED CANCELLED }
enum PaymentProvider { STRIPE PAYMOB MADA FAWRY APPLE_PAY GOOGLE_PAY }

model Order {
  id          String   @id @default(uuid())
  userId      String?
  packageId   String
  package     Package  @relation(fields: [packageId], references: [id])
  amountMinor Int
  currency    String
  status      OrderStatus @default(PENDING)
  payments    Payment[]
  createdAt   DateTime @default(now()) @db.Timestamptz
  updatedAt   DateTime @updatedAt @db.Timestamptz

  @@index([userId, status])
}

model Payment {
  id              String   @id @default(uuid())
  orderId         String
  order           Order    @relation(fields: [orderId], references: [id])
  provider        PaymentProvider
  providerRef     String                       // provider's charge/session id
  amountMinor     Int
  currency        String
  status          OrderStatus
  rawPayload      Json?                         // provider response (redacted)
  createdAt       DateTime @default(now()) @db.Timestamptz

  @@unique([provider, providerRef])
  @@index([orderId])
}

model WebhookEvent {
  id          String   @id @default(uuid())
  provider    PaymentProvider
  eventId     String                           // provider event id (idempotency)
  type        String
  payload     Json
  processedAt DateTime? @db.Timestamptz
  createdAt   DateTime @default(now()) @db.Timestamptz

  @@unique([provider, eventId])                // dedupe webhook retries
}
```

## 4. Indexing & performance notes

- `Game.roomCode` unique + lookups are O(1); codes are **recycled** (a completed
  game's code is freed) but uniqueness is only enforced among *active* rooms via
  Redis presence — Postgres keeps historical uniqueness via a partial pattern: in
  practice we suffix-recycle and rely on Redis for live collision checks.
- `Answer @@unique([roundId, participantId])` is the database-level guarantee
  behind duplicate-answer prevention (defense in depth with the Redis lock).
- Analytics hot paths: `Answer(gameId, participantId)`, `Question(categoryId,
  difficulty)`, `Game(status, createdAt)`.

## 5. Migrations & seed

- `prisma migrate dev` in development; `prisma migrate deploy` in CI/CD.
- Seed (`prisma/seed.ts`): a SUPER_ADMIN (from env), a handful of categories, one
  free demo package with ~20 bilingual questions, and the built-in avatar set
  reference data. Seed is idempotent (upserts).

## 6. Data lifecycle / retention

- Live ephemeral state (Redis) TTL: room key expires 2h after last activity.
- Finished `Game` + `GameResult` retained indefinitely (analytics).
- `AdminAuditLog` retained ≥ 1 year.
- Media: orphaned `MediaAsset` (no references, `PENDING` > 24h) garbage-collected.
