// Webflow runtime for the painterly brush-stroke SECTION reveal. Bundled into
// main.js (loaded site-wide), it auto-mounts every [data-painterly-reveal]
// container and plays the reveal ONCE when the section scrolls into view:
//
//   <div data-painterly-reveal
//        data-hero-media="<image url>"
//        data-hero-mask="<brush mask url>">
//     <script type="application/json" data-hero-config>{ ...params... }</script>
//   </div>
//
// It reuses the hero reveal's WebGL core + config payload verbatim, so a snippet
// exported from the hero-gl tool works here after renaming data-hero-reveal ->
// data-painterly-reveal. The brush look lives entirely in the mask asset; no
// shader changes. The distinct wrapper attribute keeps it from clashing with the
// hero player (which claims [data-hero-reveal]).
//
// ponytail: this deliberately mirrors ~40 lines of hero-reveal/mountHeroReveal.
// The ONLY differences are the scroll-into-view trigger and reduced-motion
// handling. Extract a shared mount(el, { start }) helper only if a third reveal
// variant appears; today two near-copies is less indirection than a shared
// abstraction reaching across the reveal folders.
import { createHeroGL, DEFAULT_HERO_PARAMS } from "../hero-reveal/core/hero-gl";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function readConfig(el) {
  const node = el.querySelector('script[type="application/json"][data-hero-config]');
  if (!node) return { ...DEFAULT_HERO_PARAMS };
  try {
    return { ...DEFAULT_HERO_PARAMS, ...JSON.parse(node.textContent || "{}") };
  } catch (error) {
    console.error("[painterly-reveal] invalid config JSON", error);
    return { ...DEFAULT_HERO_PARAMS };
  }
}

function mountPainterly(el) {
  if (el.dataset.painterlyMounted) return;
  el.dataset.painterlyMounted = "1";

  const params = readConfig(el);
  const imageUrl = el.getAttribute("data-hero-media") || "";
  const maskUrl = el.getAttribute("data-hero-mask") || "";

  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  // An absolutely-positioned canvas can't give the container height, so fall back
  // to a 16:9 box if Webflow hasn't sized it.
  if (el.clientHeight < 2 && !el.style.height && !el.style.aspectRatio) {
    el.style.aspectRatio = "16 / 9";
  }

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  el.prepend(canvas);

  const hero = createHeroGL(canvas);
  if (!hero) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const loopDur = params.loopDurationSeconds || 9;

  const renderAt = (loopProgress, loopTime) => {
    const r = el.getBoundingClientRect();
    hero.render(params, {
      width: Math.max(1, Math.round(r.width * dpr)),
      height: Math.max(1, Math.round(r.height * dpr)),
      loopProgress,
      loopTime,
      includeBg: params.includeBg,
    });
  };

  Promise.all([hero.setImageAsync(imageUrl), hero.setMaskAsync(maskUrl)]).then(() => {
    // Reduced motion: skip the animation entirely, paint the settled final frame once.
    if (window.matchMedia && window.matchMedia(REDUCED_MOTION).matches) {
      renderAt(1, 0);
      window.addEventListener("pagehide", () => hero.dispose(), { once: true });
      return;
    }

    // Paint the hidden pre-roll frame (progress 0) so the section reads as "nothing"
    // until the reveal plays — no flash of the full image before it scrolls in.
    renderAt(0, 0);

    let raf = 0;
    // Play the reveal once: reveal progress caps at 1, then holds, while raw elapsed
    // keeps the flow field alive (the core wraps it into a seamless loop). renderAt
    // reads the rect each frame, so resizes are handled without a separate listener.
    const play = () => {
      const start = performance.now();
      const frame = () => {
        const elapsed = (performance.now() - start) / 1000;
        renderAt(Math.min(elapsed / loopDur, 1), elapsed);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };

    // No IntersectionObserver (ancient browser): show the settled image rather than
    // leaving the section blank forever.
    if (typeof IntersectionObserver === "undefined") {
      renderAt(1, 0);
      window.addEventListener("pagehide", () => hero.dispose(), { once: true });
      return;
    }

    // Start the reveal when the section scrolls into view, once. rootMargin -15%
    // approximates the site's ScrollTrigger `clamp(top 85%)` start without pulling
    // GSAP into this dependency-free reveal module.
    const io = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            play();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -15% 0px", threshold: 0 },
    );
    io.observe(el);

    window.addEventListener(
      "pagehide",
      () => {
        io.disconnect();
        if (raf) cancelAnimationFrame(raf);
        hero.dispose();
      },
      { once: true },
    );
  });
}

export function initPainterly(root = document) {
  root.querySelectorAll("[data-painterly-reveal]").forEach(mountPainterly);
}
