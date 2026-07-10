import gsap from 'gsap'
import { BREAKPOINTS } from './utils/breakpoints.js'
import { debounce } from './utils/index.js'
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

    // A refresh is a synchronous reflow; running it mid-scroll stalls momentum
    // scrolling on mobile (the "scroll keeps stopping" bug). Gate every refresh
    // behind scroll-idle: if the user is scrolling, defer to one refresh once
    // they pause.
    let scrolling
    let pending
    addEventListener(
      'scroll',
      () => {
        clearTimeout(scrolling)
        scrolling = setTimeout(() => {
          scrolling = null
          if (pending) {
            pending = false
            ScrollTrigger.refresh()
          }
        }, 200)
      },
      { passive: true }
    )

    const refresh = debounce(() => {
      if (scrolling) {
        pending = true
        return
      }
      ScrollTrigger.refresh()
    }, 250)

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
  try {
    init()
  } catch (error) {
    console.error('[Main] Failed to initialize:', error)
  }
})()
