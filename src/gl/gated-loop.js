// Shared frame loop for the GL runtimes: runs only while the container is
// near the viewport and the tab is visible, and caches the canvas size from
// a ResizeObserver so render frames never read layout mid-scroll.
// The clock is wall-time based, so pausing keeps the seamless loops in phase.
export function gatedLoop(el, dpr, onFrame) {
  const size = { width: 1, height: 1 };
  const setSize = (w, h) => {
    size.width = Math.max(1, Math.round(w * dpr));
    size.height = Math.max(1, Math.round(h * dpr));
  };
  const r = el.getBoundingClientRect();
  setSize(r.width, r.height);
  const ro = new ResizeObserver(([entry]) => {
    setSize(entry.contentRect.width, entry.contentRect.height);
  });
  ro.observe(el);

  const start = performance.now();
  let raf = 0;
  let inView = false;

  const frame = () => {
    onFrame((performance.now() - start) / 1000, size);
    raf = requestAnimationFrame(frame);
  };
  const play = () => {
    if (!raf && inView && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const pause = () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      inView ? play() : pause();
    },
    { rootMargin: "100px" },
  );
  io.observe(el);

  const onVisibility = () => (document.hidden ? pause() : play());
  document.addEventListener("visibilitychange", onVisibility);

  return {
    stop() {
      pause();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
