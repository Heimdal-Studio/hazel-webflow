// Webflow runtime for the hero reveal effect. Bundled into main.js (loaded
// site-wide), it auto-mounts every [data-hero-reveal] container:
//
//   <div data-hero-reveal data-hero-media="<gradient url>" data-hero-mask="<mask url>">
//     <script type="application/json" data-hero-config>{ ...params... }</script>
//   </div>
//
// The render core is synced from ../../../hero-gl (see scripts/sync-hero-core.mjs).
import { createHeroGL, DEFAULT_HERO_PARAMS } from "./core/hero-gl";

function readConfig(el) {
  const node = el.querySelector('script[type="application/json"][data-hero-config]');
  if (!node) return { ...DEFAULT_HERO_PARAMS };
  try {
    return { ...DEFAULT_HERO_PARAMS, ...JSON.parse(node.textContent || "{}") };
  } catch (error) {
    console.error("[hero-reveal] invalid config JSON", error);
    return { ...DEFAULT_HERO_PARAMS };
  }
}

function mountHeroReveal(el) {
  if (el.dataset.heroMounted) return;
  el.dataset.heroMounted = "1";

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
    // Play the reveal once on load, then hold the settled frame.
    const start = performance.now();
    let raf = 0;
    const frame = () => {
      const elapsed = (performance.now() - start) / 1000;
      const loopTime = Math.min(elapsed, loopDur);
      renderAt(loopTime / loopDur, loopTime);
      raf = elapsed < loopDur ? requestAnimationFrame(frame) : 0;
    };
    raf = requestAnimationFrame(frame);

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => renderAt(1, loopDur), 100);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener(
      "pagehide",
      () => {
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        hero.dispose();
      },
      { once: true },
    );
  });
}

export function initHeroReveal(root = document) {
  root.querySelectorAll("[data-hero-reveal]").forEach(mountHeroReveal);
}
