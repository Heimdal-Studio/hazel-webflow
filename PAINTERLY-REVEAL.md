# Image Reveal — Webflow integration

Add **one attribute to an image** and it wipes in top-to-bottom behind a soft gradient edge
(~2.5s) when it scrolls into view, once.

## Use it

In Webflow: select the image (or any element) → **Element settings → Custom attributes** → add
`data-painterly-reveal` (leave the value empty). That's it.

```html
<img data-painterly-reveal src="...">
```

(The attribute is named `data-painterly-reveal` for backwards compatibility with the earlier
version; the effect is now a plain gradient wipe.)

## How it works

`src/painterly-reveal/index.js` (registered in `src/main.js`, ships in `dist/main.js`) finds every
`[data-painterly-reveal]`, applies a **CSS linear-gradient mask**, and wipes it top-to-bottom when
the element enters the viewport (native `IntersectionObserver`, ~`clamp(top 85%)`), once.

- Reveals the real element, so its own colours and transparency are kept. No image/mask URLs.
- Dependency-free (CSS mask + Web Animations API), no canvas.
- `prefers-reduced-motion`: the element is shown normally, no animation.

## Tuning

All in `src/painterly-reveal/index.js`:

- `DURATION_MS` — reveal duration (2500).
- `MASK` — the gradient. `to bottom` = top-to-bottom; change to `to right` / `to top` etc. for a
  different direction. Widen the `40% … 60%` stops for a softer edge.

## Notes

- A *white* texture (like `block.png`) only shows on a dark background; on a light section use a
  dark/coloured image.
- Above-the-fold images can briefly flash before the mask applies on load; add a Webflow
  interaction or a CSS `[data-painterly-reveal]{opacity:0}` guard if that matters.
- Deploy: `npm run build` in `dev-hazel/`, then commit/push (Vercel auto-deploys `main.js`, which
  Webflow already loads).

## Testing locally

```
npm run build
python3 -m http.server 8123   # from dev-hazel/
```

Open `http://localhost:8123/scripts/painterly-smoke.html` and scroll down — the section image
wipes in.
