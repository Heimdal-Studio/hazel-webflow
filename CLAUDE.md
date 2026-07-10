# dev-hazel — Hazel's Webflow custom code

Vite repo serving all custom JS for the Hazel Webflow site. Two bundles, both built by `npm run build` and deployed to Vercel (`hazel-webflow`, project `prj_2NGGFdzDiL8RiFfpAF94KYa3IiTh`):

- `dist/main.js` — site JS (GSAP animations, nav, pages, painterly reveal). UMD; `gsap`/`jquery` are externals (Webflow head CDN provides them).
- `dist/gl.js` — standalone WebGL bundle (all three GL effects), built by the second pass (`vite.config.gl.js` → entry `src/gl/embed.js`). Split so GL loads as its own parallel script and never bloats main.js. Exposes `window.HazelGL.initAll()` for manual re-scans.

Webflow loads both via the smart loader in Project Settings → Custom Code → before `</body>`: it probes `localhost:4012` and falls back to the Vercel URLs. The localhost list must include `src/gl/embed.js` (third entry) or GL effects vanish in dev mode. A `<link rel="preload" href="…/gl.js" as="script">` in Head Code covers the loader's probe-roundtrip delay ("preloaded but not used" console warnings in dev mode are expected noise).

## Code style

Match the surrounding file. On comments specifically: write few. Code should read on its own, so comment only the non-obvious *why* — a gotcha, an ordering constraint, a workaround — never the *what*. No block comment narrating a function (one short line above a shared helper is the max), no step-by-step narration inside a function body (a one-word section label at most), no inline comment that just restates its line.

## GL effects (authored in ../hazel-gl, served from here)

- `src/gl/<effect>/index.js` — Webflow runtime per effect; mounts `[data-hero-reveal]` / `[data-career-hero]` / `[data-fluid-bg]` embeds (data attrs for asset URLs + inline `<script type="application/json" data-*-config>` for tuned params).
- `src/gl/<effect>/<effect>-gl.ts` + `<effect>-shader.ts` — render cores **synced** from `../hazel-gl/src/app/<effect>/` by `node scripts/sync-gl-cores.mjs`. Generated — never edit here; edit in hazel-gl and re-sync.
- `api/blob-upload.js` — Vercel serverless fn; hazel-gl's Export Code actions POST images here (Vercel Blob) and reference the returned URLs in embed snippets.
- The hero DOM contract (`data-hero-media`, `data-hero-mask`, `data-hero-config`) is live on the published site — keep it byte-compatible.

## Workflow

- Dev: `npm run dev` (port 4012) + Webflow preview with the loader; effects hot-reload.
- Ship: commit → `git push` (Vercel auto-deploys) or `vercel --prod --yes`. A GL 404 on the live site means prod was never redeployed after a build change.
- After editing shaders/cores in hazel-gl: `node scripts/sync-gl-cores.mjs && npm run build`, then deploy.

Docs: `README.md` (loader snippet), `HERO-REVEAL.md` (hero embed flow), `PAINTERLY-REVEAL.md` (CSS-only reveal). `src/shaders/heroShader.js` is an older THREE.js ambient-wave effect (separate from the GL trio; three.js comes from the Webflow head CDN).

## Tracking (RudderStack / PostHog / UTM handoff)

Site-wide head code, not this repo's JS bundle — lives directly in Webflow's Project Settings → Custom Code, not in `src/`. `docs/tracking/utm-trial-link-tracking.md` covers the UTM-capture-and-trial-link-handoff script (must load *before* the RudderStack snippet — loading after silently kills RudderStack init entirely, see the incident section) plus session notes on which parts of the marketing team's dev spec (`docs/tracking/hazel-webflow-developer-spec.html`) hold up against the live site vs. don't. `APP_DOMAIN` for the login route is `hazel.altruist.com` (no `auth.` prefix — that's the separate Auth0 tenant domain).
