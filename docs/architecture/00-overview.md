# Tahaddi — Architecture Overview

> **Tahaddi (تحدّي — "Challenge")** is a real-time multiplayer trivia & elimination
> game built for a TV-show-grade experience. It is inspired by the *Seen Jeem*
> format but is an original product with a modern, premium, Arabic-first design.

This document is the entry point to the architecture. Read it first, then the
numbered documents in order.

| # | Document | Purpose |
|---|----------|---------|
| 00 | Overview (this file) | Product, goals, glossary, phase plan |
| 01 | [Technical Architecture](./01-technical-architecture.md) | System decomposition, tech stack rationale, data flow |
| 02 | [Database Schema](./02-database-schema.md) | Prisma models, ERD, indexing, migrations |
| 03 | [Folder Structure](./03-folder-structure.md) | Monorepo layout & module boundaries |
| 04 | [API Specification](./04-api-specification.md) | REST endpoints, auth, error envelope |
| 05 | [WebSocket Specification](./05-websocket-specification.md) | Events, payloads, validation, error handling |
| 06 | [State Management](./06-state-management.md) | Server-authoritative model, game FSM, Zustand stores |
| 07 | [Deployment Architecture](./07-deployment-architecture.md) | Docker, Railway, CI/CD, environments |
| 08 | [Security Architecture](./08-security-architecture.md) | AuthN/Z, anti-cheat, rate limiting, audit logs |
| 09 | [Scaling Strategy](./09-scaling-strategy.md) | Redis adapter, horizontal scaling, capacity model |
| 10 | [Payments Architecture](./10-payments-architecture.md) | Provider-agnostic abstraction layer |
| 11 | [Design System](./11-design-system.md) | Tokens, motion language, RTL, TV safe areas |

---

## 1. Product Vision

A host opens the **Main Screen** on any large display (Smart TV, laptop → HDMI,
tablet, projector). A room is created, a **QR code** and 6-char **room code**
appear. Players scan with their phones, open the **Mobile Controller** in a
browser (no install), pick a nickname + avatar, and join. The host starts the
game; questions appear on the big screen, players answer on their phones, wrong
answers are eliminated round by round until a winner remains.

A separate **Admin Dashboard** lets operators manage question packages,
categories, media assets, analytics, and (future) revenue.

### Experience pillars
1. **Premium / TV-grade** — cinematic motion, particle FX, glassmorphism, 60 FPS.
2. **Arabic-first, fully bilingual** — RTL by default, English parity, dark mode.
3. **Zero-friction join** — scan → play in < 10 seconds.
4. **Trustworthy real-time** — < 100 ms perceived response, robust reconnection.
5. **Fair** — server-authoritative scoring, anti-cheat, no client trust.

---

## 2. The Three Clients + One Backend

```
                         ┌──────────────────────────────┐
                         │        Backend (API + WS)     │
                         │  Express REST · Socket.IO      │
                         │  Prisma · PostgreSQL · Redis   │
                         └───────────────┬────────────────┘
            REST + WS (room channel)     │     REST + WS (admin namespace)
        ┌────────────────┬───────────────┼───────────────────────────┐
        │                │               │                           │
 ┌──────▼──────┐  ┌──────▼───────┐  ┌────▼─────────┐         ┌────────▼────────┐
 │ Main Screen │  │   Mobile     │  │    Mobile    │  ...    │ Admin Dashboard │
 │  (host/TV)  │  │ Controller 1 │  │ Controller N │         │  (operators)    │
 └─────────────┘  └──────────────┘  └──────────────┘         └─────────────────┘
```

- **Main Screen** — read-mostly projection of authoritative game state; renders
  lobby, questions, timers, live answer viz, scoreboard, eliminations, winner.
- **Mobile Controller** — thin input device: nickname/avatar, answer submission,
  personal status. One per player.
- **Admin Dashboard** — CRUD over content + analytics; never touches live rooms
  directly except through moderation endpoints.

All three are **React + TypeScript + Vite** apps sharing a `packages/shared`
library (types, socket event contracts, i18n keys, design tokens).

---

## 3. Game Modes (MVP scope)

| Mode | Description | MVP |
|------|-------------|-----|
| **Individual** | Each player for themselves; elimination on wrong answer. | ✅ |
| **Teams** | Players grouped; team eliminated when all members out, or by aggregate score. | ✅ |
| **Sudden Death** | No second chances; first wrong answer eliminates. Tie-break engine. | ✅ |
| **Tournament** | Multiple rooms → bracket → finals. Persisted across sessions. | ⚠️ Schema + API ready, full UI is post-MVP |

Configurable per game: player count **2–100**, question count, per-question
timer, elimination rules, scoring (speed bonus on/off), lives (1–N).

---

## 4. Glossary

| Term | Meaning |
|------|---------|
| **Room** | A live game session keyed by a 6-char join code. |
| **Host** | The Main Screen connection that owns a room. |
| **Controller** | A player's mobile connection bound to one Participant. |
| **Participant** | A player's membership in a room (nickname, avatar, score, lives, status). |
| **Round** | One question lifecycle: reveal → countdown → lock → reveal answer → resolve. |
| **Package** | A curated, ordered set of questions (the sellable unit). |
| **Question** | Prompt + options + correct answer + optional media + metadata. |
| **FSM** | The server-side game state machine governing legal transitions. |
| **Authoritative state** | Server-held truth; clients render projections of it. |

---

## 5. Development Phases (gated, no skipping)

1. **Architecture** ← *current* — all docs in this folder.
2. **Database** — Prisma schema, migrations, seed.
3. **Backend Foundation** — Express, config, auth, REST, error envelope, logging.
4. **WebSocket System** — Socket.IO namespaces, room FSM, event contracts, Redis adapter.
5. **Main Screen** — React app: lobby, QR, questions, timers, scoreboard, FX.
6. **Mobile Controller** — React app: join, avatar, answer UI, reconnection.
7. **Admin Dashboard** — auth, content CRUD, bulk import, media upload, analytics.
8. **Payments** — abstraction layer + Stripe reference adapter; others stubbed.
9. **Testing** — unit, integration, socket E2E, load test to 100 concurrent.
10. **Deployment** — Dockerfiles, Railway config, CI/CD, observability.

**Exit gate per phase:** decisions explained · risks identified · improvements
suggested · production-ready code generated · nothing from a later phase pulled
forward without noting it.

---

## 6. Non-Goals for MVP (explicit)

- Native mobile apps (browser only).
- Voice/video chat between players.
- AI-generated questions (content is human-curated via admin).
- Real-money wagering / gambling mechanics.
- Full multi-region active-active DB (single primary + read replica path documented).
