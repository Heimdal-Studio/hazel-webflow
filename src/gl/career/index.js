// Webflow runtime for the Career Hero background. Bundled into main.js (loaded
// site-wide), it auto-mounts every [data-career-hero] container:
//
//   <div data-career-hero data-career-photo="<photo url>" data-career-mask="<mask url>">
//     <script type="application/json" data-career-config>{ ...params, loopDurationSeconds, canvasWidth }</script>
//   </div>
//
// The render core is synced from ../../../hazel-gl (see scripts/sync-gl-cores.mjs).
import { createCareerGL, DEFAULT_CAREER_PARAMS } from "./career-gl";

function readConfig(el) {
  const node = el.querySelector('script[type="application/json"][data-career-config]');
  if (!node) return { ...DEFAULT_CAREER_PARAMS };
  try {
    return { ...DEFAULT_CAREER_PARAMS, ...JSON.parse(node.textContent || "{}") };
  } catch (error) {
    console.error("[career-hero] invalid config JSON", error);
    return { ...DEFAULT_CAREER_PARAMS };
  }
}

function mountCareerHero(el) {
  if (el.dataset.careerMounted) return;
  el.dataset.careerMounted = "1";

  const { loopDurationSeconds, canvasWidth, ...params } = readConfig(el);
  const photoUrl = el.getAttribute("data-career-photo") || "";
  const maskUrl = el.getAttribute("data-career-mask") || "";

  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  if (el.clientHeight < 2 && !el.style.height && !el.style.aspectRatio) {
    el.style.aspectRatio = "16 / 9";
  }

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  el.prepend(canvas);

  const career = createCareerGL(canvas);
  if (!career) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const loopDur = loopDurationSeconds || 30;
  // Line density is authored in tool-canvas pixels; keep the tuned reference width.
  const designWidth = canvasWidth || 1920;

  const renderAt = (loopProgress, loopTime) => {
    const r = el.getBoundingClientRect();
    career.render(params, {
      width: Math.max(1, Math.round(r.width * dpr)),
      height: Math.max(1, Math.round(r.height * dpr)),
      canvasWidth: designWidth,
      loopProgress,
      loopTime,
      includeBg: true,
    });
  };

  const ready = [];
  if (photoUrl) ready.push(career.setImageAsync(photoUrl));
  if (maskUrl) ready.push(career.setMaskAsync(maskUrl));
  Promise.all(ready).then(() => {
    // Perpetual seamless loop; renderAt reads the rect each frame, so resizes
    // are handled without a separate listener.
    const start = performance.now();
    let raf = 0;
    const frame = () => {
      const elapsed = (performance.now() - start) / 1000;
      const t = (elapsed % loopDur) / loopDur;
      renderAt(t, elapsed % loopDur);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    window.addEventListener(
      "pagehide",
      () => {
        if (raf) cancelAnimationFrame(raf);
        career.dispose();
      },
      { once: true },
    );
  });
}

export function initCareerHero(root = document) {
  root.querySelectorAll("[data-career-hero]").forEach(mountCareerHero);
}
