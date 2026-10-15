# Bullion Basis: design system ("Alpenglow Desk")

> **v2 (2026-10-15), web app in `web/`.** Same theme and tokens, rebuilt in React + Tailwind 4 + Motion, with a GSAP
> scroll replay. Changes from v1: the display/UI font is **Geist** (self-hosted, OFL) instead of Satoshi, so the strict
> CSP needs no third-party font host. Panels use a double-bezel shell (2rem outer radius, 6px padding, concentric
> inner radius). A story page (`/`) precedes the Lab (`/lab`). Stitch reference: project "Gold Spread Lab - Team
> Blaze", design system from `.claude/design/DESIGN.md`. Its layout was used; its invented copy was not.

**Chosen 2026-10-15** from three rendered directions (Bullion Ledger, Alpenglow Desk, Assay Sheet; preview in
`.claude/design/theme-options.html`). Why: it echoes the deck's title photo (first light on a dark ridge), reads as a
serious trading desk, and gives the strongest motion story. A light variant is kept for white slides.

## Direction

- **Read:** an analyst dashboard for traders and judges. Dark-first, calm, one copper-gold light.
- **Dials:** variance 5 (a rail and an asymmetric hero; the data views stay on a grid), motion 6, density 6.
- **Anchor:** the hero bars, where each gap grows past a white cost marker. You can see at a glance that the gap is about 5× costs.
- **Rule kept from v1:** the hero always shows **real** data. Synthetic history appears only inside panels with a yellow banner.

## Tokens (`prototype/styles.css`)

| Role | Dark (default) | Light |
|---|---|---|
| `--bg` / `--surface` / `--surface-2` | `#0E1319` / `#151C25` / `#1B2430` | `#EEF1F5` / `#FFFFFF` / `#F6F8FA` |
| `--text` / `--text-2` / `--text-3` | `#E9ECF1` / `#A9B2BF` / `#98A2AF` | `#121820` / `#4A5563` / `#556070` |
| `--accent` (the one light) | `#E39A5B` | `#A9561A` |
| `--accent-text` (active rail item) | `#E39A5B` | `#8A4512` |
| status good / warn / bad | `#5BC994` / `#E8B451` / `#F2796E` | `#1B7346` / `#855600` / `#B42318` |
| contracts M / TEN / GUINEA / PETAL | `#3D87DC` `#1AA581` `#B0407E` `#B0820F` | `#2A6FC0` `#1BA07E` `#B0397A` `#A8780E` |

The contract colours are CVD-validated (dataviz validator, all pairs, both modes). Copper never marks a contract, so it
only ever means "look here".

**Type:** Satoshi (Fontshare, falls back to the system sans offline) for UI; JetBrains Mono (OFL, bundled) for every
number. **Icons:** Phosphor regular (MIT, bundled, 20 glyphs used). **Shape:** 14px cards, 10–12px controls, pill badges.

## Contrast (computed by script)

| Pair | Dark | Light |
|---|---|---|
| text-2 on surface | 8.01 | 7.87 |
| text-3 on surface-2 | 6.05 | n/a |
| accent on bg / surface | 8.03 | 5.21 |
| active rail text on its tint | 6.04 | 6.13 |
| accent-ink on accent (buttons) | 8.06 | 5.21 |

## Motion (each one has a job; all off under `prefers-reduced-motion`)

| Motion | Communicates |
|---|---|
| Headline reveals left to right, then the gap bars grow past the cost marker and settle | Hierarchy: the finding first, then its size against costs |
| Numbers count up once | Emphasis on the figures that matter |
| Rail indicator slides to the active step | State change: where you are in the pipeline |
| Panel enters from the direction of travel; cards cascade | Sequence of the pipeline steps |
| Chart lines draw left to right on first view | Time runs left to right |
| **Replay day by day** (Signal): the future is veiled, a playhead walks the window, trades appear only when reached, and the alert feed updates per day | No look-ahead, shown rather than claimed |
| Breathing dot on the data chip | Live data status (the only loop) |

Implementation: Web Animations API and CSS only (transform, opacity, clip-path, stroke-dashoffset). No scroll
listeners and no animation library. The prototype must open from a file on the demo laptop with no build step.

## Skills applied, and what was not

- Applied: design-taste-frontend (design read, dials, no em-dashes, Phosphor icons, mono numbers, motion must be
  motivated, reduced motion), gpt-taste (motion-rich and premium, no meta-labels), frontend-design (a named
  direction with one memorable anchor), stitch-design-taste (token roles, anti-patterns), frontend-developer
  (accessible tabs, states, performance).
- Not applied: the React/Next/Tailwind/GSAP stack (it would add a build step for no user benefit here), the
  landing-page structure (AIDA, picsum stock photography, marquees: this is a data tool, and the real charts are the
  visuals), and centred heroes.
- Stitch: three reference screens were requested in project "Gold Spread Lab - Team Blaze". Every call timed out, and
  the project still listed no screens afterwards, so no Stitch output was used.

## Verified (Playwright, Chromium)

5 steps × dark and light × 1600×900 and 390×844. No console errors or failed requests, no axe WCAG 2.2 AA violations,
and no horizontal scroll at 390 px. Motion: no animation is left running or stuck invisible after the entrance, and
the replay veils the future and clears when it finishes. Arrow keys move between rail steps. A grayscale shot of
Normalize keeps its hierarchy.
