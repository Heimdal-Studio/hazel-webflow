# Hero Reveal — Webflow integration

The hero reveal effect (authored in the sibling `hero-gl/` Toolcraft tool) runs on
Webflow through this repo's site-wide `main.js` bundle. You tune it in the tool,
click **Export Code**, and paste one snippet into a Webflow Embed.

## Pieces

- `src/hero-reveal/index.js` — the runtime. Auto-mounts every `[data-hero-reveal]`
  on the page, reads its config + image/mask URLs, and renders on load.
- `src/hero-reveal/core/` — the shared WebGL render core, **synced** from
  `../hero-gl/src/app` (do not edit here). Re-sync after changing the shader/renderer:
  `node scripts/sync-hero-core.mjs`, then rebuild + redeploy.
- `api/blob-upload.js` — Vercel function that stores uploaded gradient/mask images
  in Vercel Blob and returns public URLs (used by the tool's Export).

## One-time setup

1. **Install deps** (adds `@vercel/blob`): `npm install`
2. **Add a Blob store** so uploads work:
   `vercel blob store add hero-assets` (this sets `BLOB_READ_WRITE_TOKEN` on the project).
3. **Deploy**: push to GitHub (Vercel auto-deploys) or `vercel --prod`. This serves
   `main.js` (already wired into Webflow via the dev/prod switcher in `README.md`) and
   the `/api/blob-upload` function.
4. **Point the tool at the endpoint**: in `../hero-gl/src/app/hero-export.ts`, set
   `BLOB_UPLOAD_URL = "https://<your-dev>.vercel.app/api/blob-upload"`.

## Using it

1. In the `hero-gl` tool: drop your gradient + mask, tune, click **Export Code**
   (snippet copied to clipboard).
2. In Webflow: drop an **Embed** element into your hero section and paste. Give the
   embed (or its section) a height — the canvas fills the container.

The pasted snippet looks like:

```html
<div data-hero-reveal
     data-hero-media="https://<blob>/hero-gradient-xxxx.jpg"
     data-hero-mask="https://<blob>/hero-mask-xxxx.jpg">
  <script type="application/json" data-hero-config>{ ...tuned params... }</script>
</div>
```

If the Blob endpoint isn't set up yet, Export Code still runs and emits
`PASTE_YOUR_GRADIENT_URL` / `PASTE_YOUR_MASK_URL` placeholders you can fill with any
hosted image URLs (e.g. Webflow assets).

## Notes

- The runtime needs no dependencies (raw WebGL2); gsap/plugins in the bundle are for
  other site modules, not the hero.
- Cross-origin images require CORS. Vercel Blob URLs are permissive, so this is
  handled; if you use another host, ensure it sends `Access-Control-Allow-Origin`.
- The reveal plays once on load and holds (no loop), per the site behavior.
