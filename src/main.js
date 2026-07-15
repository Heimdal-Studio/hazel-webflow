import gsap from 'gsap'
import { BREAKPOINTS } from './utils/breakpoints.js'
import { requestScrollRefresh } from './utils/scroll-refresh.js'
import { initHome } from './pages/home.js'
import { initContact } from './pages/contact.js'
import { initGlobal } from './global.js'
import { initNav } from './nav.js'
import { initPainterly } from './painterly-reveal/index.js'

;(() => {
  // =============================================
  // GSAP SETUP
  // =============================================
  // Dev fallback: use npm gsap if CDN isn't present (Webflow preview always provides CDN)
  if (!window.gsap) window.gsap = gsap

  // =============================================
  // CONFIG
  // =============================================
  const CONFIG = {
    breakpoints: BREAKPOINTS,
    selectors: {
      pageWrapper: '.page-w',
    },
  }


  // =============================================
  // INIT
  // =============================================
  // Triggers are created before fonts swap in and before lazy images decode, so
  // their cached scroll positions go stale as the page settles. Coalesce every
  // settle event (fonts ready, load, lazy images) into ONE debounced refresh.
  function initScrollRefresh() {
    if (typeof ScrollTrigger === 'undefined') return

    // Scroll-idle gating lives in utils/scroll-refresh.js (shared with the FAQ
    // accordions in global.js).
    const refresh = requestScrollRefresh

    document.fonts?.ready.then(refresh) // display font swap reflows text (incl. SplitText)

    window.addEventListener('load', () => {
      refresh() // initial images / CSS settled
      // Lazy images below the fold reshape flow when they decode later on scroll.
      document.querySelectorAll('img').forEach((img) => {
        if (!img.complete) img.addEventListener('load', refresh, { once: true })
      })
    })
  }

  function init() {
    // GL effects (hero reveal, career hero, fluid bg) live in the separate
    // dist/gl.js bundle (src/gl/embed.js) so they load in parallel — see README.
    // Painterly brush reveal mounts on any [data-painterly-reveal] section (scroll-triggered).
    initPainterly()
    initScrollRefresh()

    const page = document.querySelector(CONFIG.selectors.pageWrapper)
    if (!page) return

    if (page.classList.contains('is--home')) initHome()
    if (page.classList.contains('is--contact')) initContact()

    initGlobal()
    initNav()
  }

  // =============================================
  // START
  // =============================================
  function start() {
    try {
      init()
    } catch (error) {
      console.error('[Main] Failed to initialize:', error)
    }
  }

  // GSAP + its plugins load from defer'd CDN <script>s, but this bundle is
  // injected async by the loader and can execute first (warm cache). Touching
  // ScrollTrigger/SplitText/CustomEase before they exist throws — wait for them.
  function whenPluginsReady(cb) {
    const ready = () => window.ScrollTrigger && window.SplitText && window.CustomEase
    if (ready()) return cb()
    let tries = 0
    const id = setInterval(() => {
      if (ready() || ++tries > 100) {
        clearInterval(id)
        cb() // fire anyway after ~5s so a blocked CDN degrades instead of hanging
      }
    }, 50)
  }

  whenPluginsReady(start)
})()
