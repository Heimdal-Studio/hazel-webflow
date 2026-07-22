# Hero intro (`data-hero-intro`)

Choreographed reveal of the pieces inside a hero. One engine, `initHeroIntro` in
[src/global.js](src/global.js), drives every page. ~90% of heroes need **zero
markup** beyond `data-hero-intro` on the container — roles are inferred from the
existing Webflow classes and play on a shared default sequence. Per-page-type
differences are declarative.

Not to be confused with `data-start="hidden"` (a generic block fade owned by the
Webflow footer/head code) or `data-hero-reveal` (the WebGL hero, see
[HERO-REVEAL.md](HERO-REVEAL.md)). The intro reveals the hero's *inner* pieces
after the container block-fades in.

## Roles

Add `data-hero-intro=""` to the hero container. These roles are inferred
automatically (no per-element markup), on this default timeline:

| Role      | Inferred from                | at (s) | Preset      |
|-----------|------------------------------|--------|-------------|
| `image`   | `.hero_img`                  | 0.2    | rise (LCP)  |
| `title`   | `h1`                         | 0.5    | highlight   |
| `para`    | `.w-richtext`                | 0.8    | fade        |
| `list`    | *(opt-in only)*              | 0.9    | fade-stagger|
| `buttons` | `.button-group .button-w`    | 1.0    | fade-stagger|
| `form`    | *(opt-in only)*              | 1.1    | fade        |
| `eyebrow` | `.eyebrow_wrap`              | 1.35   | fade        |
| `type`    | `[data-typewriter]` (first)  | 1.35   | typewriter  |

Presets: `rise` (up + scale settle), `highlight` (per-char fill), `typewriter`
(per-char type-on), `fade` (up + fade, optional stagger).

## Extra pieces (lead-capture / pricing)

Pieces with no default selector (a steps list, an embedded form) opt in with
`data-hero-item`:

```html
<div class="demo-h_list" data-hero-item="list"></div>
<div class="demo-h_form" data-hero-item="form"></div>
```

`data-hero-item` also accepts any of the inferred role names to tag an element
explicitly.

## Per-element overrides

On any hero piece:

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

Inferred pieces are already pre-hidden by the existing class rules. Add one rule
so opt-in `data-hero-item` pieces don't flash before the timeline runs:

```css
[data-hero-intro] [data-hero-item] { visibility: hidden; }
```

`prefers-reduced-motion` shows every piece with no motion.
