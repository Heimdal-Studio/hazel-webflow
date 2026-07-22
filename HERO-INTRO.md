# Hero intro (`data-hero-intro`)

Choreographed reveal of the pieces inside a hero. One engine, `initHeroIntro` in
[src/global.js](src/global.js), drives every page. Fully attribute-driven: a
piece animates only if it carries its role attribute, `data-hero-<role>`. The
role supplies the default order, preset, and timing, so a standard hero needs no
other attributes. Nothing is targeted by class, so repeated classes inside the
hero (e.g. `.eyebrow_wrap` on numbered list items) are never touched by accident.

Not to be confused with `data-start="hidden"` (a generic block fade owned by the
Webflow footer/head code) or `data-hero-reveal` (the WebGL hero, see
[HERO-REVEAL.md](HERO-REVEAL.md)). The intro reveals the hero's *inner* pieces
after the container block-fades in.

## Setup

1. `data-hero-intro=""` on the hero container (a variant key is optional, below).
2. `data-hero-<role>` on each piece you want animated.

| Role attribute | at (s) | Preset | Notes |
|---|---|---|---|
| `data-hero-img` | 0.2 | rise (LCP) | up + scale settle |
| `data-hero-title` | 0.5 | highlight | per-char fill |
| `data-hero-text` | 0.8 | fade | up + fade |
| `data-hero-list` | 0.9 | fade | stagger 0.1 |
| `data-hero-buttons` | 1.0 | fade | stagger 0.08 |
| `data-hero-form` | 1.1 | fade | |
| `data-hero-testimonial` | 1.2 | fade | |
| `data-hero-eyebrow` | 1.35 | fade | the `.eyebrow_wrap` block |
| `data-hero-type` | 1.35 | typewriter | per-char type-on (typewriter text) |

Putting the same role attribute on several elements groups them into one
staggered reveal, e.g. `data-hero-list` on each `.demo-h_item`. Put it on the
wrapper instead to move the whole block as one.

A typewriter eyebrow is two attributes: `data-hero-eyebrow` on `.eyebrow_wrap`
and `data-hero-type` on the inner typewriter text.

## Per-element overrides

On any tagged piece:

- `data-hero-order="0.7"` — set the absolute timeline position (s).
- `data-hero-delay="0.2"` — offset the resolved position.
- `data-hero-preset="fade|rise|highlight|typewriter"` — swap the reveal.

## Per-page-type variant

`data-hero-intro="demo"` selects a variant. Add only the differing roles to
`HERO_VARIANTS` in [src/global.js](src/global.js):

```js
const HERO_VARIANTS = {
  demo: { list: { at: 0.9 }, form: { at: 1.1 } },
}
```

Empty value (`data-hero-intro=""`) = default sequence.

## Webflow anti-FOUC (paste once, Head Code)

Pre-hide every tagged piece before the timeline runs. CSS can't wildcard
attribute names, so the roles are listed (attribute-based, stable, only grows
when a role is added):

```css
[data-hero-intro] [data-hero-img],
[data-hero-intro] [data-hero-title],
[data-hero-intro] [data-hero-text],
[data-hero-intro] [data-hero-list],
[data-hero-intro] [data-hero-buttons],
[data-hero-intro] [data-hero-form],
[data-hero-intro] [data-hero-testimonial],
[data-hero-intro] [data-hero-eyebrow],
[data-hero-intro] [data-hero-type] { visibility: hidden; }
```

Remove the old class-based block. `prefers-reduced-motion` shows every piece
with no motion.
