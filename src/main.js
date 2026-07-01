import gsap from 'gsap'
import { BREAKPOINTS } from './utils/breakpoints.js'
import { initHome } from './pages/home.js'
import { initContact } from './pages/contact.js'
import { initGlobal } from './global.js'
import { initNav } from './nav.js'
import { initHeroReveal } from './hero-reveal/index.js'
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
  function init() {
    // Hero reveal mounts on any page that has a [data-hero-reveal] embed.
    initHeroReveal()
    // Painterly brush reveal mounts on any [data-painterly-reveal] section (scroll-triggered).
    initPainterly()

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
