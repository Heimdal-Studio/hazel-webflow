// Webflow runtime for the Fluid BG effect. Bundled into main.js (loaded
// site-wide), it auto-mounts every [data-fluid-bg] container:
//
//   <div data-fluid-bg>
//     <script type="application/json" data-fluid-config>{ ...params, loopDurationSeconds }</script>
//   </div>
//
// The render core is synced from ../../../hazel-gl (see scripts/sync-gl-cores.mjs).
import { createFluidGL, DEFAULT_FLUID_PARAMS } from "./fluid-gl";

// Legacy configs (pre glow-dots, 2026-07-06) carried ink/color2/color3 instead
// of a glows[] array. Map them onto the classic fixed anchors so published
// embeds keep rendering pixel-identically (x 1.02 is intentionally off-canvas,
// matching the old shader constants).
function upgradeLegacyConfig(config) {
  if (config.glows || !(config.ink || config.color2 || config.color3)) return config;
  const d = DEFAULT_FLUID_PARAMS.glows;
  return {
    ...config,
    glows: [
      { x: 0.12, y: 0.82, color: config.ink || d[0].color, radius: 0.85, strength: 1 },
      { x: 1.02, y: 0.52, color: config.color2 || d[1].color, radius: 0.95, strength: 1 },
      { x: 0.08, y: 0.12, color: config.color3 || d[2].color, radius: 0.7, strength: 1 },
    ],
  };
}

function readConfig(el) {
  const node = el.querySelector('script[type="application/json"][data-fluid-config]');
  if (!node) return { ...DEFAULT_FLUID_PARAMS };
  try {
    return {
      ...DEFAULT_FLUID_PARAMS,
      ...upgradeLegacyConfig(JSON.parse(node.textContent || "{}")),
    };
  } catch (error) {
    console.error("[fluid-bg] invalid config JSON", error);
    return { ...DEFAULT_FLUID_PARAMS };
  }
}

function mountFluidBg(el) {
  if (el.dataset.fluidMounted) return;
  el.dataset.fluidMounted = "1";

  const { loopDurationSeconds, ...params } = readConfig(el);

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
