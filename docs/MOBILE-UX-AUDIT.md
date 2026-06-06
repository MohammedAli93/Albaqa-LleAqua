# Mobile UI/UX Audit & Fix Report — Controller App

**Scope:** `apps/controller` — the player-facing app that runs on phones. The
`screen` app is a TV/big-screen surface (landscape, not handheld) and `admin` is a
desktop dashboard, so neither is in the mobile-device scope of this audit.

**Tested target matrix (reasoned against CSS, not just one device):** iPhone SE
(375×667 / 320 logical small), iPhone 14 (390×844), iPhone 15 Pro Max (430×932),
Galaxy S23 (360×780), Galaxy A series (360×800), plus generic small/large phones —
in **portrait and landscape**.

---

## Root-cause themes

The bad mobile feel traced to three systemic causes, not a hundred unrelated bugs:

1. **`100vh` everywhere (`min-h-screen`).** Every screen sized itself to `100vh`,
   which on mobile is the *large* viewport — it counts the space behind the
   browser address bar and bottom toolbar. Result: bottom-pinned CTAs (login,
   join, profile, lifelines) sat **behind the browser chrome / off-screen**, and
   full-height screens felt cut off.
2. **A flex trap on the question screen.** Answer options lived in a
   `flex-1 content-center` box with no scroll, so 5–6 options (or any options in
   landscape / on iPhone SE) were **clipped and unreachable**.
3. **Per-frame re-renders + always-on animations.** The countdown re-rendered the
   entire question tree ~60×/sec, and ambient animations ran regardless of the
   user's "reduce motion" setting — jank and battery drain.

---

## Issues found & fixes applied

| # | Screen(s) | Problem | Root cause | Fix |
|---|-----------|---------|------------|-----|
| 1 | **All** | Bottom buttons hidden behind browser bars; full-height screens cut off | `min-h-screen` = `100vh` (large viewport) | Converted every `min-h-screen` / `min-h-full` to **`min-h-dvh`** (dynamic viewport height). Unified `App.tsx` wrappers + all 11 screens. |
| 2 | **Answer** | Options clipped / unreachable with 5–6 options, on SE, or in landscape | `grid flex-1 content-center` with no overflow handling | Wrapped options in a `min-h-0 flex-1 overflow-y-auto` container with an inner `my-auto` grid — centres when there's room, scrolls (page-level) when it overflows, so **no option is ever clipped**. |
| 3 | **Answer** | Whole question + 6 option buttons re-rendered ~60×/sec | `useCountdown` `requestAnimationFrame` loop calling `setState` each frame | Replaced with a **single GPU keyframe animation** (width + colour) on the timer bar, keyed by `roundId`. Zero React re-renders during the countdown. |
| 4 | **Global** | Janky scroll, costly repaints on iOS | `background-attachment: fixed` on `<body>` (broken/expensive on iOS Safari) | Removed; the fixed `<Aurora/>` layer already provides the parallax feel. Added `-webkit-overflow-scrolling: touch`. |
| 5 | **Global** | Animations ignored OS "Reduce Motion"; battery/jank | No `prefers-reduced-motion` handling (despite a comment claiming otherwise) | Added a global CSS `@media (prefers-reduced-motion: reduce)` kill-switch **and** wrapped the app in Framer's `<MotionConfig reducedMotion="user">`. |
| 6 | **App shell** | Reconnecting/paused banner rendered under the notch / status bar | `position: fixed; top-0` is relative to the viewport, ignoring the `<body>` safe-area padding | Added `padding-top: calc(env(safe-area-inset-top) + 0.75rem)` to the banner. |
| 7 | **Home** | Logout icon had a ~20px hit target (below the 44px guideline) | Bare `<LogOut>` icon, no padding | Made it a `h-11 w-11` (44px) centred tap target via negative margin (no layout shift). |
| 8 | **Home** | Long usernames overflowed the hero row / pushed the flag & logout out | `flex-1` with no `min-w-0`, name not truncated | Added `min-w-0` to the flex column and `truncate` to the name; flag/logout marked `shrink-0`. |
| 9 | **Lobby** | Long nicknames overflowed horizontally at `text-4xl` | No wrap/clamp on the name | Added `max-w-full break-words`. |
| 10 | **Play** | Team/per-team stepper buttons were 40px (just under 44px) | `h-10 w-10` | Bumped to `h-11 w-11` (44px). |
| 11 | **SeenJeem** | Answering / draft / select views could clip content on small screens | `min-h-screen` (`100vh`) | Converted to `min-h-dvh`; with no `overflow:hidden` the views now grow and the page scrolls, keeping options + lifelines reachable. |

---

## Verified-OK (no change needed)

- **Safe-area insets** — handled globally on `<body>` via `env(safe-area-inset-*)`
  padding + `viewport-fit=cover`.
- **iOS input-zoom on focus** — all inputs are `≥ text-xl` (≥16px), so iOS won't
  auto-zoom; combined with `maximum-scale=1` (a deliberate app-like choice to stop
  accidental double-tap zoom during fast tapping).
- **No fixed-px width traps** — layout uses `max-w-md` / viewport-relative sizes.
- **No nested-scroll containers** — there is a single document scroll context; the
  Answer overflow container only engages as a safety net and does not create a
  competing scrollbar.
- **Touch feedback** — `touch-action: manipulation`, `-webkit-tap-highlight-color:
  transparent`, and Framer `whileTap` press states already in place.

---

## Performance

- Eliminated the 60fps re-render storm on the most interactive screen (Answer).
- Removed `background-attachment: fixed` (a known iOS scroll-repaint cost).
- Ambient infinite animations now stop entirely under "Reduce Motion".

## Validation

- `pnpm --filter @tahaddi/controller typecheck` — passes.
- `pnpm --filter @tahaddi/controller build` — passes (production bundle builds clean).

## Follow-ups (optional, not blocking)

- `apps/controller/src/hooks/useCountdown.ts` is now unused (Answer no longer needs
  it; SeenJeem has its own local copy). Safe to delete in a cleanup pass.
- Consider a real device-lab pass (BrowserStack) to confirm the `dvh` behaviour on
  older iOS/Android WebViews that predate dynamic viewport units (they fall back to
  `100vh`-equivalent, i.e. today's behaviour — no regression).
