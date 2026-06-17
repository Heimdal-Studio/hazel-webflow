# Hero Shader Effect — Design Spec

**Date:** 2026-06-17
**Project:** Hazel
**Status:** Approved for implementation

---

## Context

The Hazel home hero has a full-section background image (sandy/earthy texture, dark blue-grey top transitioning to warm brown). The goal is to make this background feel alive: a slow organic wave runs continuously, and grain + UV distortion radiates from the cursor when the mouse moves over the hero.

Source reference: https://github.com/jankohlbach/codrops-shader-on-scroll (already downloaded to `_work/codrops-shader-on-scroll-master/`). We adapt the shaders but remove all scroll-based effects and replace them with time-driven ambient animation.

---

## What We're Building

A Three.js WebGL canvas layered over the hero background image, applying:
1. **Ambient wave** — slow, continuous sine-wave vertex deformation driven by `uTime`
2. **Mouse grain + distortion** — a circular noise field that activates as the cursor enters and moves across the hero section

No scroll effects. No Lenis. No scroll velocity uniform.

---

## Architecture

### Files changed

| File | Type | Change |
|---|---|---|
| `vite.config.js` | Modified | Add `three` to `external` + `globals` |
| `src/pages/home.js` | Modified | Import and call `initHeroShader()` |
| `src/shaders/heroShader.js` | New | Full WebGL implementation (self-contained) |

### Delivery

Three.js loaded via CDN from Webflow head custom code (same pattern as GSAP — already external in this project):
```html
<script src="https://cdn.jsdelivr.net/npm/three@0.166.0/build/three.min.js"></script>
```

Vite config treats `three` as external with global `THREE`.

### Webflow setup (one-time, done by Vitalie)

1. Add the Three.js `<script>` tag above in Webflow head custom code
2. Add custom attribute `data-webgl-hero` to the hero section element
3. Ensure the hero section has `position: relative` (Webflow sections default to this)

---

## Canvas Strategy

Canvas is injected **absolute inside the hero section** (not full-page fixed). This means:
- No scroll tracking needed — canvas lives in the DOM flow with the section
- No IntersectionObserver needed — canvas is only in the DOM when the section is
- No `setPositions()` math
- JS creates the canvas element and appends it as first child of `[data-webgl-hero]`

Canvas CSS (injected by JS):
```css
position: absolute;
top: 0; left: 0;
width: 100%; height: 100%;
pointer-events: none;
z-index: 0;
```

The hero section's existing children (text, buttons, UI mockup) must sit above the canvas layer. Webflow sections typically create a stacking context and child divs are rendered in DOM order — since the canvas is prepended as the first child with `z-index: 0`, content added after it in the DOM sits on top naturally. If anything renders behind the canvas, add `position: relative; z-index: 1` to the hero's content wrapper in Webflow (a Webflow class, not JS).

---

## Background Image Loading

The background image is set as a CSS `background-image` on the hero section in Webflow. JS extracts the URL:

```js
const bgStyle = getComputedStyle(heroEl).backgroundImage
// "url(https://uploads-ssl.webflow.com/...)"
const imageUrl = bgStyle.match(/url\(["']?(.+?)["']?\)/)?.[1]
```

Loaded with `THREE.TextureLoader`. Once loaded, the original CSS background is hidden:
```js
loader.load(imageUrl, (texture) => {
  material.uniforms.uTexture.value = texture
  heroEl.style.backgroundImage = 'none'
  startRenderLoop()
})
```

---

## Shader Design

### Vertex shader (ambient wave)

Replaces the scroll-velocity bow deformation with a time-driven organic wave:

```glsl
float wave = sin(uv.x * PI) * sin(uTime * 0.4) * 0.015
           + sin(uv.x * PI * 2.0 + 1.5) * sin(uTime * 0.25) * 0.006;
position.y -= wave;
```

Two overlapping sine waves at different frequencies and phases create organic, non-repeating motion. Amplitudes (0.015, 0.006) are subtle — just enough to read as alive without distorting the composition.

`uScrollVelocity` uniform is removed entirely.

### Fragment shader (grain + distortion)

Two layers of effect:

**1. Ambient UV drift (always on, very subtle):**
```glsl
texCoords.x += snoise(vec2(vUv.x * 3.0 + uTime * 0.15, vUv.y * 2.0)) * 0.003;
texCoords.y += snoise(vec2(vUv.x * 2.0, vUv.y * 3.0 + uTime * 0.1)) * 0.003;
```
The noise field drifts slowly over time, giving the texture a living quality even without the mouse.

**2. Mouse grain + distortion (activates on hover):**
```glsl
float circle = 1.0 - distance(
  vec2(uMouseOverPos.x, (1.0 - uMouseOverPos.y) * aspectRatio),
  vec2(vUv.x, vUv.y * aspectRatio)
) * 15.0;

float noise = snoise(gl_FragCoord.xy);
float mouseEffect = mix(0.0, circle * noise * 0.012, uMouseEnter);
texCoords.x += mouseEffect;
texCoords.y += mouseEffect;
```
Same circular falloff as Codrops original. Grain radiates from cursor position, strongest at center of circle.

GLSL noise function: Ashima Arts simplex noise (`snoise`) — copied from `codrops-shader-on-scroll-master/shader/resources/noise.glsl`.
UV cover mapping: `getCoverUvVert` — copied from `codrops-shader-on-scroll-master/shader/resources/utils.glsl`.

Both inlined as template literal strings (no `vite-plugin-glsl` needed).

---

## Uniforms

| Uniform | Type | Source |
|---|---|---|
| `uTime` | float | RAF timestamp / 1000 |
| `uResolution` | vec2 | Window dimensions |
| `uTexture` | sampler2D | TextureLoader result |
| `uTextureSize` | vec2 | texture.image natural dimensions |
| `uQuadSize` | vec2 | Hero section bounding rect |
| `uMouseEnter` | float | GSAP tweened 0→1 on hover in, 1→0 on hover out |
| `uMouseOverPos` | vec2 | Lerped cursor position relative to hero section |

Removed: `uScrollVelocity`, `uBorderRadius`, `uCursor` (global cursor not needed).

---

## Mouse Handling

Events listen on the hero section element (`[data-webgl-hero]`):
- `mouseenter` → GSAP tween `mouseEnter` 0→1 (0.6s ease)
- `mousemove` → update `mouseOverPos.target` from `e.offsetX / bounds.width`
- `mouseleave` → GSAP tween `mouseEnter` 1→0, tween `mouseOverPos.target` back to center

`mouseOverPos` lerped in RAF with factor 0.05 (same as original).

GSAP is already external in this project — import from `'gsap'`, no change to externals config needed.

---

## Resize Handling

On resize:
- Renderer resized to `window.innerWidth × window.innerHeight`
- Camera FOV recalculated
- Mesh scale updated to new hero section bounds
- `uQuadSize` and `uTextureSize` uniforms updated

Debounced at 300ms.

---

## Camera

Perspective camera at Z=500 with FOV calculated so 1px in screen space = 1 unit in world space:
```js
const fov = 2 * Math.atan(window.innerHeight / 2 / 500) * (180 / Math.PI)
```
Standard pattern from Codrops source.

---

## Geometry

`PlaneGeometry(1, 1, 100, 100)` — 100×100 subdivisions (needed for smooth vertex wave deformation). Scaled to hero section bounds via `mesh.scale.set(width, height, 1)`.

---

## Render Loop

```
RAF → update mouseOverPos lerp → update time/resolution/mouse uniforms → renderer.render()
```

Single mesh, single material — no mediaStore array needed (this is one background, not multiple images).

---

## Verification

1. Run `npm run dev` in `_work/dev/`
2. Open Hazel site with localhost script injection
3. Add `data-webgl-hero` to hero section via Webflow inspector
4. Confirm: background image displays via WebGL
5. Confirm: slow wave animation visible on the background
6. Confirm: grain/distortion appears as cursor moves over hero
7. Confirm: effect fades out when cursor leaves
8. Confirm: resize works (no stretching)
9. Confirm: hero text/buttons are clickable (pointer-events none on canvas)
