# 11 — Design System

The look: **a modern Arabic game show.** Deep midnight stage, volumetric color,
glass surfaces, gold as the prize accent, cinematic motion. Premium, confident,
energetic — significantly more modern than the reference. Arabic-first, fully
bilingual, dark by default.

> Direction informed by the UI/UX intelligence pass (premium dark + gold, bold
> display typography for gaming/entertainment) but deliberately steered away from
> retro/CRT toward **clean glassmorphism + volumetric gradients**, which reads as
> high-end broadcast rather than nostalgic.

## 1. Brand & mood

- **Stage, not page.** The Main Screen is a broadcast set: a dark arena with a
  glowing focal area, depth via layered gradients and particles, content floating
  on glass.
- **Gold = stakes.** Gold is reserved for the prize, the winner, the leader — never
  decoration. Scarcity makes it feel valuable.
- **Energy with restraint.** Lots of motion, but choreographed and purposeful;
  nothing jitters for its own sake.

## 2. Color system (design tokens)

Tokens live in `packages/ui/tokens` and feed a Tailwind preset
(`packages/config/tailwind-preset.cjs`). HSL-based so we can derive states.

### Core palette (dark, primary theme)
| Token | Hex | Use |
|-------|-----|-----|
| `bg.base` | `#0A0A14` | Deepest stage background |
| `bg.raised` | `#12121F` | Panels behind glass |
| `bg.sunken` | `#06060D` | Vignette edges |
| `surface.glass` | `rgba(255,255,255,0.06)` | Glass panel fill |
| `surface.glass-strong` | `rgba(255,255,255,0.10)` | Glass needing legibility |
| `border.glass` | `rgba(255,255,255,0.12)` | Glass edge highlight |
| `text.primary` | `#F5F5FA` | Primary text |
| `text.secondary` | `#A9A9C2` | Secondary text |
| `text.muted` | `#6E6E8A` | Muted / meta |

### Brand & accent (volumetric gradient stops)
| Token | Hex | Use |
|-------|-----|-----|
| `brand.violet` | `#7C3AED` | Primary brand |
| `brand.indigo` | `#4F46E5` | Brand gradient partner |
| `brand.magenta` | `#C026D3` | Energy accent |
| `brand.cyan` | `#22D3EE` | Cool highlight / live indicators |
| `prize.gold` | `#F5C518` | Winner, leader, prize **(scarce)** |
| `prize.gold-deep` | `#B8860B` | Gold gradient shadow |

### Semantic
| Token | Hex | Use |
|-------|-----|-----|
| `success` | `#22C55E` | Correct answer |
| `danger` | `#EF4444` | Wrong / elimination |
| `warning` | `#F59E0B` | Low time |
| `info` | `#38BDF8` | Neutral notices |

### Signature gradients
- `gradient.stage` — radial `brand.indigo → bg.base` behind the focal area.
- `gradient.brand` — linear `brand.violet → brand.magenta` (CTAs, headings).
- `gradient.prize` — linear `prize.gold → prize.gold-deep` (winner moments).
- `gradient.live` — animated conic hue-rotate, used sparingly on "LIVE" badges.

### Light theme
A high-legibility light variant (per the skill's contrast checklist) for the admin
dashboard primarily: `bg #FAFAFB`, text `#0C0A14`, glass uses `bg-white/80+`,
borders `#E5E7EB`. The game screens are dark-only by design (stage aesthetic).

### Contrast
All text/background pairs meet **WCAG AA (≥ 4.5:1)**; large display text ≥ 3:1.
Color is never the *only* signal — correct/wrong also use icon + motion + position.

## 3. Typography

Two script families, each with a display + body pairing, so Arabic and Latin both
look intentional (not one font stretched across both).

| Role | Arabic | Latin | Notes |
|------|--------|-------|-------|
| Display (headings, big numbers) | **Tajawal** (700/900) | **Russo One** / **Chakra Petch** (700) | Bold, broadcast-grade, energetic. |
| Body / UI | **IBM Plex Sans Arabic** | **Chakra Petch** (400/500) | Highly legible at distance and on mobile. |
| Numerals / timers | tabular figures of body font | same | `font-variant-numeric: tabular-nums` so countdowns don't jitter. |

- **Arabic-first:** the default `lang=ar dir=rtl`; Arabic fonts load first.
- Large type everywhere on the screen app (TV legibility from across a room):
  questions ~`clamp(2.5rem, 5vw, 5rem)`, timers larger still.
- Body min **16px** on mobile (controller); line-height 1.5–1.7; line length capped.

## 4. RTL & bilingual architecture

- Direction driven by `dir` attribute + Tailwind's logical properties
  (`ps-*/pe-*/ms-*/me-*`, `start/end`) — **no hard-coded left/right**. Switching
  language flips the entire layout correctly.
- `tailwindcss-rtl` / logical-property utilities in the shared preset.
- Icons that imply direction (arrows, progress) mirror in RTL; brand/logos do not.
- i18n in `packages/i18n` (ar/en JSON), keys shared; numbers localized
  (Arabic-Indic optional, default Western digits for clarity on timers).
- Mixed-content safe: nicknames may be Latin in an Arabic UI — `unicode-bidi:
  isolate` on user strings prevents bidi mangling.

## 5. Motion language (Framer Motion)

Motion is a first-class part of the product, not polish. Centralized variants in
`packages/ui/motion` so all apps move consistently.

### Timing scale
| Token | ms | Use |
|-------|----|----|
| `motion.instant` | 100 | taps, toggles |
| `motion.fast` | 180 | micro-interactions, hovers |
| `motion.base` | 280 | most transitions |
| `motion.slow` | 480 | scene enters |
| `motion.cinematic` | 800–1400 | winner reveal, elimination |

Easing: standard `[0.22, 1, 0.36, 1]` (expo-out) for entrances; `[0.4, 0, 0.2, 1]`
for moves; springs (`stiffness 260, damping 26`) for playful/physical elements
(player tokens, score pops).

### Signature sequences
1. **Player join** — token flies in from screen edge, scales with a spring
   overshoot, ripple of light, nickname types in. Staggered when several join.
2. **Question reveal** — stage gradient pulses, question rises + fades up, options
   stagger in with 60 ms offsets, timer ring ignites.
3. **Live answer viz** — bars/avatars animate as `answer:received` counts climb;
   coalesced data tweened smoothly (no popping).
4. **Lock** — options "freeze" with a glass-frost sweep; timer ring snaps to 0.
5. **Reveal** — correct option blooms green + particles; wrong options desaturate
   and recede; distribution bars animate to final heights.
6. **Elimination** — eliminated tokens shatter/dissolve into particles and fall
   away; survivors slide to close ranks (Framer layout animations).
7. **Leaderboard** — rows reorder with shared-layout (`layoutId`) animations; rank
   changes flash a delta; the leader gets a gold aura.
8. **Winner** — full-screen gold gradient sweep, confetti/particle burst, winner
   token ascends to center with a crown, spotlight, name in display gold.

### Performance discipline (60 FPS)
- Animate **only `transform` + `opacity`** (GPU-composited); never animate
  width/height/top/left.
- Particle systems use a single canvas/WebGL layer, capped particle counts, and
  `requestAnimationFrame`; degrade count on low-end devices.
- `will-change` applied transiently, removed after.
- Heavy scenes virtualize off-screen players (a 100-player grid renders only what's
  visible / summarizes the rest).
- **`prefers-reduced-motion`** respected everywhere: sequences collapse to simple
  fades, particles disabled — accessibility and motion-sickness safety.

## 6. Layout & responsiveness

### Main Screen (TV / large)
- Designed for **16:9**, robust from 1280×720 up to 4K.
- **TV safe area:** 5% inset on all edges (`safe-area` utility); nothing critical
  in the outer margin (overscan protection on real TVs).
- Fluid type via `clamp()`; a base "stage" grid with a central focal zone, a
  player rail, and a status strip.
- Assumes **lean-back viewing** — readable across a room, minimal fine text.

### Mobile Controller (touch)
- Single-column, thumb-zone-first. Primary action (answer) occupies the lower,
  reachable half.
- **Touch targets ≥ 44×44px** (answer buttons far larger — full-width tiles).
- Big, unambiguous states: "answer locked," "you're out," "you won."
- `viewport-fit=cover` + safe-area insets for notched devices; **wake-lock** during
  a game so the screen doesn't sleep; optional **haptics** on submit/result.
- Works one-handed, in portrait, on mid-range Android over mobile data.

### Admin (desktop-first, responsive)
- Dense data UI: sidebar nav, data tables, forms, charts; light theme default with
  dark option. Standard breakpoints 375 / 768 / 1024 / 1440.

## 7. Components (shared `packages/ui`)

`GlassPanel`, `Button` (brand/ghost/gold variants), `Avatar`, `PlayerToken`,
`CountdownRing`, `AnswerTile`, `OptionBar`, `LeaderboardRow`, `ScorePill`,
`LivesIndicator`, `QrCard`, `RoomCodeDisplay`, `ParticleField`, `SceneTransition`,
`Badge` (LIVE/mode), `Toast`. Each ships RTL-correct, themed via tokens, and
motion-aware. No emoji as icons — **Lucide** SVG icon set throughout.

## 8. Accessibility baseline (non-negotiable)

- WCAG AA contrast; visible focus rings (keyboard play supported on controller).
- All icon-only buttons have `aria-label`; images have alt text.
- Color never the sole indicator (correct/wrong/eliminated also use shape, icon,
  motion, position).
- `prefers-reduced-motion` honored; `prefers-color-scheme` for admin.
- Screen-reader-friendly announcements for state changes ("answer locked",
  "you advanced to round 4") via polite live regions on the controller.
