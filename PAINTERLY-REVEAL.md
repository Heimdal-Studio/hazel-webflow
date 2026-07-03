# Painterly Reveal — Webflow integration

Add **one attribute to an image** and it gets painted in by a brushy sweep (~1.5s) when it
scrolls into view, once.

## Use it

In Webflow: select the image (or any element) → **Element settings → Custom attributes** → add
`data-painterly-reveal` (leave the value empty). That's it.

```html
<img data-painterly-reveal src="...">
```

## How it works

`src/painterly-reveal/index.js` (registered in `src/main.js`, ships in `dist/main.js`) finds every
`[data-painterly-reveal]`, applies a generated **CSS brush-ramp mask**, and sweeps it across when
the element enters the viewport (native `IntersectionObserver`, ~`clamp(top 85%)`), once.

- Reveals the real element, so its own colours and transparency are kept. No image/mask URLs.
- Dependency-free (CSS mask + Web Animations API). The brush ramp is generated in-module; nothing
  to host.
- `prefers-reduced-motion`: the element is shown normally, no animation.

## Notes

- A *white* texture (like `block.png`) only shows on a dark background; on a light section use a
  dark/coloured image.
- Duration is `DURATION_MS` (1500ms) in the module. The sweep direction/edge can be adjusted in
  `sweepMask()` / the animation if needed.
- Above-the-fold images can briefly flash before the mask applies on load; add a Webflow
  interaction or a CSS `[data-painterly-reveal]{opacity:0}` guard if that matters.
- Deploy: `npm run build` in `dev/`, then commit/push (Vercel auto-deploys `main.js`, which
  Webflow already loads).

## Testing locally

```
npm run build
python3 -m http.server 8123   # from dev/
```

Open `http://localhost:8123/scripts/painterly-smoke.html` and scroll down — the section image
sweeps in. (`scripts/gen-brush-mask.html` is a leftover brush-mask generator from the earlier
WebGL approach; not used by the current CSS-mask module.)
