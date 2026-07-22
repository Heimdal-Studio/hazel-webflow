# Analytics attribute convention (Webflow Designer)

What to add in Webflow so the tracking JS can resolve every click to
`{ event, label, module, plan }`. Companion to [utm-trial-link-tracking.md](./utm-trial-link-tracking.md)
and the marketer's Section 3 event catalog.

**Principle: buttons get no attribute by default.** The label auto-derives from the button's
own visible text; the module auto-derives from the section's `section_*` class; trial buttons
are detected by href. You add an attribute *only* to override a wrong auto value or to declare
plan intent. If in doubt, add nothing and let it auto-derive.

## The whole vocabulary

| Attribute | Goes on | Value | When |
|---|---|---|---|
| `data-price-event` | pricing card wrapper; page-level wrapper on product pages | `financial_planning_agent` \| `admin_ai` \| `tax_planning_agent` \| `bundle_all` \| `enterprise` | Routine — pricing cards + each product page |
| `data-module` | a `section_*` wrapper | stable slug, e.g. `feature-cards-roles` | Only to override auto-from-class (collisions / generic class) |
| `data-label` | a button/link, or a wrapper right around it (nearest ancestor wins) | stable slug | Only when the text is a bad signal (icon-only, duplicate, copy churns) |
| `data-event` | a button/link, or a wrapper right around it | an event name from the catalog | Only when the auto event type is wrong |

## Auto-derivation (why you don't tag most things)

- **label** = slug of the element's visible text at click time (`slug` = lowercase,
  non-alphanumerics → `_`, trimmed). `data-label` overrides.
- **module** = nearest `[data-module]` ancestor, else nearest `section_<name>` class minus the
  `section_` prefix (`section_bento` → `bento`). Same section class on different pages = same
  module, which is intended.
- **trial** = any `a[href*="auth.hazel.altruist.com"]`. The head UTM-handoff script owns
  `trial_signup_started` (it's coupled to the auth redirect); `src/tracking.js` deliberately
  swallows those clicks so they don't double as `cta_clicked`. A "Start free trial" button
  pointing at `/demo-request` is a demo CTA, not a trial — it correctly becomes `cta_clicked`.
  Neither needs tagging.

## Existing hooks — reuse, do NOT re-tag

- **Nav** (`nav.js`): `data-dropdown-toggle` (value = panel name), `data-burger-toggle`,
  `data-nav-list-item`, `data-menu-logo`, `data-menu-open`. Nav needs zero new attributes.
- **Tabs** (`global.js`): section `[data-init-progress]`, tab buttons `.progress_item` (text =
  tab label). Optionally add `data-module` on `section_progress` for a stable name.
- **Testimonials** (`global.js`): `[data-prev]` / `[data-next]`, `[data-testimonial-item].is--active`,
  `[data-current]`. No new attributes.
- **Pricing billing toggle** (`global.js`): `.pricing_component[data-price-status]` already holds
  `monthly`/`annual` → that's `billing_period`. No new attribute.

## Per-page checklist (first pass: Home, Pricing, Tax Planning)

### Product pages (Tax Planning, and future product pages)
- Add `data-price-event="tax_planning_agent"` on the top wrapper `.page-w.is--product`
  (use the matching plan value per product page). Page-level fallback so every CTA on the page
  carries plan intent.
- Nothing else — all sections auto-derive their module.

### Pricing
- On each plan card `.pricing_item_c`, add `data-price-event="<plan>"` (`admin_ai`,
  `tax_planning_agent`, `bundle_all`, `enterprise` — match built cards; grow to the 5-value target
  as cards ship). `billing_period` comes free from `.pricing_component[data-price-status]`.
- **Verify the Webflow mechanic first:** `.pricing_item_c` is a component instance. If the Designer
  lets you add a custom attribute directly on the instance, do that; otherwise expose it as a
  component property, or put `data-price-event` on the nearest non-component wrapper around each
  card. Check on one card before doing all.

### Home
- Add `data-module` on the two `section_feature-cards` sections to tell them apart:
  `feature-cards-roles` ("Built for every role") and `feature-cards-ai` ("AI-led where it helps").
  Everything else auto-derives.

### Overrides — add lazily, only when you spot a bad auto value
- Icon-only / empty-text button that matters → `data-label`.
- Two identical-text buttons in the same module you need distinct → `data-label`.
- Button whose auto event type is wrong → `data-event`.

## Reconciliation (before the JS ships)

- The live UTM/trial-handoff head script reads `intended_plan` from `[data-plan]`. This convention
  standardizes on `data-price-event`. Update that head script's selector to match (one line), or
  the trial handoff and `track()` events will disagree on plan source.
- Marketer's open item: GTM's `utm_plan`-in-href tracking vs. this `data-price-event` for pricing
  clicks — keep both or retire GTM's, before the pricing page goes live (double-counting risk).

## Verify after tagging (before writing the JS)

Load each page and run this in the console (or via chrome-devtools) to dry-run the derivation:

```js
const slug = s => (s||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
const moduleOf = el => el.closest("[data-module]")?.dataset.module
  ?? el.closest("[class*='section_']")?.className.match(/section_([a-z0-9-]+)/)?.[1] ?? null;
[...document.querySelectorAll("a.button, button.progress_item, .pricing_item_c a")].map(el => ({
  text: el.textContent.trim().slice(0,30),
  label: el.dataset.label || slug(el.textContent),
  module: moduleOf(el),
  plan: el.closest("[data-price-event]")?.dataset.priceEvent ?? null,
  trial: !!el.closest('a[href*="auth.hazel.altruist.com"]'),
}));
```

Pass = every pricing CTA shows the right `plan`, the two Home feature-card sections show distinct
`module`, no important button has an empty/duplicate `label`. Add the minimal override and re-run.
The consuming JS is `src/tracking.js` (initialized in `main.js` before the GSAP wait).
