# Painterly brush-stroke section reveal — design

**Date:** 2026-07-01
**Status:** implemented

## Problem

Mid-page Webflow sections (e.g. the "Compliance and Security" section) should reveal their
background image in a painterly way: from nothing, ~7 rough brush strokes sweep the image in
as a directional wipe, once, when the section scrolls into view. The section's Webflow text
stays untouched on top.

## Key insight — reuse, don't rebuild

The hero reveal already does directional masked image reveals: `hero-gl/` authors them and
exports a Webflow embed; `dev/src/hero-reveal/` plays `[data-hero-reveal]` on the live site,
driving a shared WebGL2 core (`src/hero-reveal/core/`, synced from `hero-gl`). Only two things
separate "hero" from "brush section reveal":

1. The player triggers on **page load**, not scroll.
2. The brush look — which lives entirely in the **grayscale mask**, so no shader change.

## Decisions

- Trigger: scroll-into-view, once.
- Brush art: generated (7 rough strokes along the sweep axis).
- Feel: directional sweep.
- Approach: **reuse the WebGL engine** as a new, isolated, dependency-free module — no changes
  to the hero runtime or the shared shader core.

## Design

- **`src/painterly-reveal/index.js`** — mirrors `hero-reveal/mountHeroReveal`, differing only
  in trigger + reduced-motion. Claims `[data-painterly-reveal]` (distinct from the hero), reuses
  the same `data-hero-media` / `data-hero-mask` / `data-hero-config` payload, imports
  `createHeroGL` + `DEFAULT_HERO_PARAMS` from `../hero-reveal/core/hero-gl` unchanged. Starts
  the reveal clock on a native `IntersectionObserver` (`rootMargin: 0 0 -15% 0` ≈ the site's
  `clamp(top 85%)`), plays once, holds; `prefers-reduced-motion` renders one settled frame.
- **`src/main.js`** — one import + `initPainterly()` after `initHeroReveal()`.
- **Brush mask** — generated grayscale mask (`scripts/brush-mask.js` + `gen-brush-mask.html`):
  soft-bodied paint strokes with ragged ends + dry-brush grain, stacked along the sweep axis,
  overlapping toward frame coverage. Reveal recipe: `maskStyle: "static"` + directional bloom
  (`angle`); the strokes paint in along the sweep. Tuned live in the `hero-gl` tool.

## Why static-mask + bloom (zero core change)

`maskStyle: "static"` clips the image to the brush strokes throughout; the core's Act-1 bloom
reveals directionally from a corner (`angle`), so the strokes paint in ~one at a time with soft
ragged edges. A "distinct strokes → perfectly clean unclipped image" variant would need a small
additive shader mode; deferred until wanted.

## Verification (done)

`npm run build` passes and bundles the module. Browser smoke test
(`scripts/painterly-smoke.html`): hidden before scroll (revealed fraction 0) → animates in on
enter (0 → ~0.55) → holds; text overlays cleanly; `prefers-reduced-motion` shows the final frame
immediately with no animation; console clean.

## Files

- New: `src/painterly-reveal/index.js`, `scripts/brush-mask.js`, `scripts/gen-brush-mask.html`,
  `scripts/painterly-smoke.html`, `PAINTERLY-REVEAL.md`.
- Edit (2 lines): `src/main.js`.
- Reused unchanged: `src/hero-reveal/core/*`, the shader, the `hero-gl` tool, build, Vercel.
