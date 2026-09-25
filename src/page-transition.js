// Fade the page out before navigating. It fades to the off-white canvas, which is
// what the next page first paints while its [data-start='hidden'] blocks wait on
// the footer reveal, so leaving and arriving read as one fade.
const FADE_MS = 300

function isInternalLink(a) {
  if (a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return false
  const url = new URL(a.href)
  if (url.origin !== location.origin) return false // external, mailto:, tel:, the auth app
  return url.pathname !== location.pathname || url.search !== location.search // same-page and hash links stay native
}

export function initPageTransition() {
  if (window.Webflow?.env?.('editor') !== undefined) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  let fade
  // A back/forward cache restore brings the page back faded out
  window.addEventListener('pageshow', (e) => e.persisted && fade?.cancel())

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]')
    // defaultPrevented covers nav dropdown toggles and the UTM head script's trial links
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (!isInternalLink(a)) return
    e.preventDefault()
    fade = document.body.animate({ opacity: 0 }, { duration: FADE_MS, easing: 'ease-in', fill: 'forwards' })
    fade.finished.then(() => (location.href = a.href))
  })
}
