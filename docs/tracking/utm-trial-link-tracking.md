# UTM / trial-link tracking (head code)

Implements §4–5 of Hazel's marketing team dev spec (`hazel-webflow-developer-spec.html`,
downloaded 2026-07-06): capture UTM + ad-platform click IDs on landing, and hand them to
the app's login route when a visitor clicks a trial/login link, since RudderStack/PostHog
persistence doesn't reach Postgres — only `/api/auth/login`'s own querystring does.

Lives in Webflow's site-wide head code (Project Settings → Custom Code), pasted directly
below the font/Lenis CSS and above the RudderStack snippet — **must load before RudderStack's
snippet**, not after (see incident below).

## What it does

1. **Capture** — on every page load, reads `utm_source`, `utm_medium`, `utm_campaign`,
   `utm_term`, `utm_content`, `fbclid`, `gclid`, `gbraid`, `wbraid`, `li_fat_id`, `ttclid`,
   `msclkid`, `rdt_cid` off the URL and writes them to 30-day cookies. `utm_referrer` is
   write-once (365-day cookie, never overwritten) — matches the app's own `first_touch` vs
   `current` split in Postgres.
2. **Deliver** — a delegated click listener matches any link whose `href` contains
   `auth.hazel.altruist.com` (not a Designer-added class — see below), cancels the
   navigation, and redirects instead to `https://hazel.altruist.com/api/auth/login` with
   all cookie values + `rs_aid` (RudderStack anonymous ID, for the PostHog identity bridge)
   + `intended_plan` (read from the closest `[data-plan]` ancestor) appended as query params.
   Respects the link's own `target` (`window.open(url, trigger.target || "_self")`), so the
   nav's `target="_blank"` login link still opens a new tab.

```html
<script>
(function () {
  const ALWAYS_UPDATE = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid","gbraid","wbraid","li_fat_id","ttclid","msclkid","rdt_cid"];
  const FIRST_TOUCH_ONLY = ["utm_referrer"];
  const TRACKING_KEYS = [...ALWAYS_UPDATE, ...FIRST_TOUCH_ONLY];

  function setCookie(name, value, days) {
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${days * 24 * 60 * 60}; path=/`;
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  const found = new URLSearchParams(window.location.search);

  ALWAYS_UPDATE.forEach(function (key) {
    if (found.has(key)) setCookie(key, found.get(key), 30);
  });

  FIRST_TOUCH_ONLY.forEach(function (key) {
    if (found.has(key) && !getCookie(key)) setCookie(key, found.get(key), 365);
  });

  document.addEventListener("click", function (e) {
    const trigger = e.target.closest('a[href*="auth.hazel.altruist.com"]');
    if (!trigger) return;
    e.preventDefault();

    const url = new URL("https://hazel.altruist.com/api/auth/login");
    url.searchParams.set("returnTo", "/");

    if (window.rudderanalytics && typeof rudderanalytics.getAnonymousId === "function") {
      url.searchParams.set("rs_aid", rudderanalytics.getAnonymousId());
    }

    const planCard = trigger.closest("[data-plan]");
    if (planCard) url.searchParams.set("intended_plan", planCard.dataset.plan);

    TRACKING_KEYS.forEach(function (key) {
      const value = getCookie(key);
      if (value) url.searchParams.set(key, value);
    });

    trigger.setAttribute("data-utm-tracked", url.toString());
    window.open(url.toString(), trigger.target || "_self");
  });
})();
</script>
```

## Why href-matching instead of a `w-cta-trial` class

The spec's original approach asked for a shared class added to every trial button in the
Designer. Switched to matching `a[href*="auth.hazel.altruist.com"]` instead:

- Covers the nav's live "Log in" link today with zero Designer changes.
- Auto-covers the not-yet-built pricing page's per-plan trial buttons once they ship,
  as long as they point at the same Auth0 domain — no repeated manual tagging per button.
- Trade-off: if the Auth0 domain ever changes, this silently stops matching (no error) —
  a class-based selector wouldn't have that failure mode. Acceptable given the domain is
  stable infrastructure, not page content.

`data-plan` still needs to be added manually in the Designer on each pricing card wrapper
(`financial_planning_agent` | `admin_ai` | `tax_planning_agent` | `bundle_all` |
`enterprise`) — that's DOM structure the click handler can't infer.

## Key facts confirmed this session

- **`hazel.altruist.com`** (no `auth.` prefix) is the app's own domain — confirmed by
  visiting logged-in app pages (`/advisor/onboarding`, `/advisor/ask-hazel`) and by
  `/api/auth/login` redirecting there correctly. `auth.hazel.altruist.com` is the separate
  Auth0 custom-domain tenant.
- `rudderanalytics.getAnonymousId` is **not** in the RudderStack snippet's queued-method
  stub list (only `setAnonymousId` is), so calling it before the real SDK loads returns
  `undefined` rather than queuing — guarded with a `typeof === "function"` check rather
  than calling it bare like the spec's original sample does.
- `target="_blank"` on the live nav link is real — respected via `trigger.target`, not
  hardcoded, so it stays correct for both `_blank` and same-tab trial links.

## Open items — need confirmation from the app/backend team

1. Does `/api/auth/[auth0]/route.ts` actually encode the incoming UTM/click-id params into
   `state` (or a session/cookie) before redirecting to Auth0, so they survive the OAuth
   round trip and are still available on the post-login callback? Client-side code can't
   see or control this.
2. Where does `intended_plan` get used once it arrives — pre-fill an onboarding step, or
   saved as a firm-level attribute? Flagged in the spec as "not this developer's work."
3. Ad blockers blocking `cdn.rudderlabs.com` (`net::ERR_BLOCKED_BY_CLIENT`) silently drop
   `rs_aid` and all RudderStack tracking for that visitor — known ceiling, not a bug, called
   out in the spec's own §7.

## Incident: production tracking outage, fixed 2026-07-06

An intermediate test-harness draft got pasted into the live Webflow head code instead of
the final script. Two compounding bugs, live on `hazel-2026.webflow.io`:

1. `window.rudderanalytics = { getAnonymousId: () => "test-anon-id-123" }` ran **before**
   RudderStack's own snippet. RudderStack's init does `window[e]||(window[e]=[])` — saw the
   mock object was already truthy, skipped reinitializing as an array, then
   `Array.isArray(rudderanalytics)` failed, so the *entire* RudderStack init block
   (stub methods, `.load()`, mounting the real SDK script) never ran. RudderStack was
   completely dead site-wide, not just degraded.
2. `document.getElementById("cookie-log").textContent = ...` — `#cookie-log` only existed
   in the local test file, not the live page. Threw on `null`, which aborted the rest of
   the synchronous script — meaning the actual click-tracking listener below it never
   registered either. The trial-link handoff wasn't running at all.

Fixed by pasting the clean script above (no mock, no test-DOM references) ahead of the
RudderStack snippet. Verified via DevTools console: no more `null` errors, no more mock
override; the only remaining console entry was `cdn.rudderlabs.com` being blocked by a
browser extension (ad blocker on the testing machine, not a code issue — see Open Items).

**Lesson:** never paste an in-progress test/demo draft into live Custom Code. Test scripts
that mock global objects (`window.rudderanalytics`, etc.) or reference scratch-only DOM IDs
must be clearly marked and stripped before they leave a local test file.

## Related: §6 event catalog (nav clicks, tabs, cards, carousel, HubSpot form)

Not yet implemented — out of scope for this doc. See the spec's §6 for the full catalog.
Session notes on what's real vs. speculative in that spec, confirmed against both the repo
and the live site:

- **Real, buildable today:** `initTabs()`/`switchTab()` in `global.js` already *is* the
  capability-tabs component the spec describes — tracking can hook in directly, no
  Designer work needed. Testimonials genuinely run on Swiper v8, confirmed via the live
  page's inline Embed script (`slider_wrap.swiper`, `.slider_button.is-next/.is-prev`) —
  **not** part of this repo's JS bundle, loaded as a separate raw Webflow Embed.
  `initLineRevealTestimonials()` in `global.js` does not drive the live testimonials
  section and appears to be unused/legacy code for a different component.
- **Confirmed real but spec inaccuracies:** `nav-bar_link` / `nav_panel-link` /
  `nav-bar_logo` classes do exist on the live nav (contrary to an earlier over-correction
  this session) — but the nav's "Sign in" button links to `/pricing`, not
  `/request-a-demo` as the spec states. A second link to `auth.hazel.altruist.com` exists
  elsewhere on the homepage in what looks like a comparison/pricing section — not
  investigated further this session.
- **Confirmed blocked, matches the spec's own admission:** `w-cta-track` / `w-card-track`
  classes don't exist anywhere in the repo or live site yet. Pricing page and HubSpot demo
  form are not built yet.
