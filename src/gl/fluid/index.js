// Webflow runtime for the Fluid BG effect. Bundled into main.js (loaded
// site-wide), it auto-mounts every [data-fluid-bg] container:
//
//   <div data-fluid-bg>
//     <script type="application/json" data-fluid-config>{ ...params, loopDurationSeconds, canvasWidth }</script>
//   </div>
//
// The render core is synced from ../../../hazel-gl (see scripts/sync-gl-cores.mjs).
import { createFluidGL, DEFAULT_FLUID_PARAMS } from "./fluid-gl";

function readConfig(el) {
  const node = el.querySelector('script[type="application/json"][data-fluid-config]');
  if (!node) return { ...DEFAULT_FLUID_PARAMS };
  try {
    return { ...DEFAULT_FLUID_PARAMS, ...JSON.parse(node.textContent || "{}") };
  } catch (error) {
    console.error("[fluid-bg] invalid config JSON", error);
    return { ...DEFAULT_FLUID_PARAMS };
  }
}

function mountFluidBg(el) {
  if (el.dataset.fluidMounted) return;
  el.dataset.fluidMounted = "1";

  const { loopDurationSeconds, canvasWidth, ...params } = readConfig(el);

  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  if (el.clientHeight < 2 && !el.style.height && !el.style.aspectRatio) {
    el.style.aspectRatio = "16 / 9";
  }

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  el.prepend(canvas);

  const fluid = createFluidGL(canvas);
  if (!fluid) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const loopDur = loopDurationSeconds || 10;
  // Line density is authored in tool-canvas pixels; keep the tuned reference width.
  const designWidth = canvasWidth || 1920;

  // Perpetual seamless loop; the rect is read each frame, so resizes are
  // handled without a separate listener.
  const start = performance.now();
  let raf = 0;
  const frame = () => {
    const elapsed = (performance.now() - start) / 1000;
    const t = (elapsed % loopDur) / loopDur;
    const r = el.getBoundingClientRect();
    fluid.render(params, {
      width: Math.max(1, Math.round(r.width * dpr)),
      height: Math.max(1, Math.round(r.height * dpr)),
      canvasWidth: designWidth,
      loopProgress: t,
      loopTime: elapsed % loopDur,
      includeBg: true,
    });
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  window.addEventListener(
    "pagehide",
    () => {
      if (raf) cancelAnimationFrame(raf);
      fluid.dispose();
    },
    { once: true },
  );
}

export function initFluidBg(root = document) {
  root.querySelectorAll("[data-fluid-bg]").forEach(mountFluidBg);
}
