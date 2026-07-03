// Webflow runtime for the painterly reveal. Add ONE attribute to any image (or
// element) and it gets painted in by a brushy sweep when it scrolls into view:
//
//   <img data-painterly-reveal src="...">
//
// Implemented as a CSS mask: the real element is revealed through a generated
// brush ramp, so it keeps the image's own colours + transparency, works on any
// background, needs no image/mask URLs, and has no dependencies.
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const DURATION_MS = 1500;

// Generate a horizontal brush ramp once: transparent (left) -> opaque (right),
// with bristle streaks across the transition so the sweeping edge reads as a
// brush rather than a straight gradient. Returned as a data URL, cached.
let cachedMask = null;
function sweepMask() {
  if (cachedMask) return cachedMask;
  const W = 1200;
  const H = 300;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0.0, "rgba(255,255,255,0)");
  grad.addColorStop(0.34, "rgba(255,255,255,0)");
  grad.addColorStop(0.66, "rgba(255,255,255,1)");
  grad.addColorStop(1.0, "rgba(255,255,255,1)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Bristle streaks across the transition so the sweeping edge reads as a brush.
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let i = 0; i < 1100; i++) {
    const bx = 0.22 * W + Math.random() * 0.62 * W;
    const a = Math.max(0, Math.min(1, (bx / W - 0.34) / 0.32)); // follow the ramp
    ctx.strokeStyle = `rgba(255,255,255,${(0.16 * a).toFixed(3)})`;
    ctx.lineWidth = 1 + Math.random() * 2.5;
    const y = Math.random() * H;
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.lineTo(bx + (Math.random() - 0.5) * 55, y + (Math.random() - 0.5) * 130);
    ctx.stroke();
  }

  cachedMask = canvas.toDataURL("image/png");
  return cachedMask;
}

function setMaskPos(el, posX) {
  const value = `${posX}% 50%`;
  el.style.webkitMaskPosition = value;
  el.style.maskPosition = value;
}

function mount(el) {
  if (el.dataset.painterlyMounted) return;
  el.dataset.painterlyMounted = "1";

  // Reduced motion: leave the element visible as-is, no reveal.
  if (window.matchMedia && window.matchMedia(REDUCED_MOTION).matches) return;

  const url = sweepMask();
  el.style.webkitMaskImage = `url(${url})`;
  el.style.maskImage = `url(${url})`;
  el.style.webkitMaskRepeat = "no-repeat";
  el.style.maskRepeat = "no-repeat";
  el.style.webkitMaskSize = "300% 100%";
  el.style.maskSize = "300% 100%";
  setMaskPos(el, 0); // hidden: the transparent third of the ramp covers the element

  if (typeof IntersectionObserver === "undefined") {
    setMaskPos(el, 100); // no observer: just show it
    return;
  }

  // Sweep the brush edge across when the element scrolls into view, once.
  // rootMargin -15% approximates the site's `clamp(top 85%)` start.
  const io = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.disconnect();
        const anim = el.animate(
          [
            { maskPosition: "0% 50%", webkitMaskPosition: "0% 50%" },
            { maskPosition: "100% 50%", webkitMaskPosition: "100% 50%" },
          ],
          { duration: DURATION_MS, easing: "linear" },
        );
        anim.onfinish = () => setMaskPos(el, 100); // settle fully revealed
        break;
      }
    },
    { rootMargin: "0px 0px -15% 0px", threshold: 0 },
  );
  io.observe(el);
  window.addEventListener("pagehide", () => io.disconnect(), { once: true });
}

export function initPainterly(root = document) {
  root.querySelectorAll("[data-painterly-reveal]").forEach(mount);
}
