// Webflow runtime for a simple gradient reveal. Add ONE attribute to any image
// (or element) and it wipes in top-to-bottom behind a soft gradient edge when it
// scrolls into view, once:
//
//   <img data-painterly-reveal src="...">
//
// CSS mask + Web Animations API. No dependencies, no assets, no canvas. Keeps the
// element's own colours/transparency. (Attribute name kept for backwards compat.)
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const DURATION_MS = 2500;

// Opaque (top) -> soft edge -> transparent (bottom), oversized vertically so
// sliding the position wipes a clean gradient edge down the element.
const MASK = "linear-gradient(to bottom, #000 0 40%, transparent 60% 100%)";
const MASK_SIZE = "100% 300%";

function setMaskPos(el, posY) {
  const value = `50% ${posY}%`;
  el.style.webkitMaskPosition = value;
  el.style.maskPosition = value;
}

function mount(el) {
  if (el.dataset.painterlyMounted) return;
  el.dataset.painterlyMounted = "1";

  // Reduced motion: leave the element visible as-is, no reveal.
  if (window.matchMedia && window.matchMedia(REDUCED_MOTION).matches) return;

  el.style.webkitMaskImage = MASK;
  el.style.maskImage = MASK;
  el.style.webkitMaskRepeat = "no-repeat";
  el.style.maskRepeat = "no-repeat";
  el.style.webkitMaskSize = MASK_SIZE;
  el.style.maskSize = MASK_SIZE;
  setMaskPos(el, 100); // hidden: the transparent (bottom) side of the gradient covers the element

  if (typeof IntersectionObserver === "undefined") {
    setMaskPos(el, 0); // no observer: just show it
    return;
  }

  // Wipe in top-to-bottom when the element scrolls into view, once. rootMargin
  // -15% approximates the site's `clamp(top 85%)` start.
  const io = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.disconnect();
        const anim = el.animate(
          [
            { maskPosition: "50% 100%", webkitMaskPosition: "50% 100%" },
            { maskPosition: "50% 0%", webkitMaskPosition: "50% 0%" },
          ],
          { duration: DURATION_MS, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
        );
        anim.onfinish = () => setMaskPos(el, 0); // settle fully revealed
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
