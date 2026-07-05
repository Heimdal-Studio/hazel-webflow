// Standalone entry for all WebGL effects, built to dist/gl.js and loaded in
// Webflow as its own script tag (parallel to main.js, so the GL code never
// blocks or bloats the main bundle). Mounting is idempotent (each runtime
// guards with a data-*-mounted flag), so re-running init is always safe.
import { initHeroReveal } from './hero/index.js'
import { initCareerHero } from './career/index.js'
import { initFluidBg } from './fluid/index.js'

function initAll(root = document) {
  initHeroReveal(root)
  initCareerHero(root)
  initFluidBg(root)
}

// Manual re-scan hook for dynamically injected embeds (e.g. Webflow editor).
window.HazelGL = { initAll, initHeroReveal, initCareerHero, initFluidBg }

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initAll())
} else {
  initAll()
}
