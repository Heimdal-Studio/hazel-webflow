// RudderStack click instrumentation — marketer's event catalog, attribute
// conventions in docs/tracking/attribute-convention.md. Labels/modules are
// auto-derived at click time; data-label / data-event / data-price-event override.
// trial_signup_started is NOT fired here — the UTM-handoff script in Webflow's
// head owns it (coupled to the auth redirect). Trial clicks are swallowed below
// so they don't double as cta_clicked.

const AUTH_DOMAIN = 'auth.hazel.altruist.com'

// UI toggles with no event in the catalog
const IGNORED = '[data-price-toggle], [data-toggle], .accordion_button, .nav-banner_close-btn, [data-mobile-back]'

const slug = (s) =>
  (s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const track = (event, props) => {
  // ad blockers kill the SDK site-wide — degrade silently (spec §7 known ceiling)
  window.rudderanalytics?.track(event, props)
}

const moduleOf = (el) => {
  const tagged = el.closest('[data-module]')
  if (tagged) return tagged.dataset.module
  const sec = el.closest('[class*="section_"]')
  return sec?.className.match(/section_([\w-]+)/)?.[1] || null
}

// overrides resolve via closest() so they can sit on the element itself or a
// wrapper — Webflow component instances don't always accept custom attributes
const labelOf = (el) => el.closest('[data-label]')?.dataset.label || slug(el.textContent).slice(0, 80)

const isTrial = (el) => (el.getAttribute('href') || '').includes(AUTH_DOMAIN)

const baseProps = (el) => ({
  cta_label: labelOf(el),
  cta_destination: el.getAttribute('href') || null,
  module_name: moduleOf(el),
  page_path: location.pathname,
})

const navItemName = (el) => {
  if (el.closest('[data-menu-logo]')) return 'logo'
  if (el.dataset.dropdownToggle) return slug(el.dataset.dropdownToggle)
  // panel links carry title + description text; label from the title span only
  const title = el.querySelector('.nav_panel-link-p-span, .nav-bar_link-p')
  return slug((title || el).textContent).slice(0, 80)
}

// ponytail: breakpoint check, not which physical nav copy was clicked — only
// the matching copy is clickable at any width, so it's equivalent
const navVariant = () => (window.innerWidth <= 991 ? 'mobile' : 'desktop')

let lastArrowAt = 0

function handleClick(e) {
  // backdrop is a plain div — handle before the a/button resolution
  const backdrop = e.target.closest('[data-menu-backdrop]')
  if (backdrop) {
    track('mobile_nav_toggled', { action: 'closed', trigger: 'backdrop', page_path: location.pathname })
    return
  }

  const el = e.target.closest('a, button')
  if (!el) return

  const forced = el.closest('[data-event]')
  if (forced) {
    track(forced.dataset.event, baseProps(el))
    return
  }

  if (el.matches(IGNORED)) return

  // --- nav ---
  if (el.closest('[data-menu-wrap]')) {
    if (el.closest('[data-burger-toggle]')) {
      // nav.js's direct listener ran first (target phase), so menu state is current
      const open = el.closest('[data-menu-wrap]').dataset.menuOpen === 'true'
      track('mobile_nav_toggled', { action: open ? 'opened' : 'closed', trigger: 'burger_button', page_path: location.pathname })
      return
    }
    track('nav_item_clicked', {
      nav_item: navItemName(el),
      nav_variant: navVariant(),
      page_path: location.pathname,
      destination_url: el.getAttribute('href') || null,
    })
    return
  }

  // --- capability tabs ---
  const tab = el.closest('.progress_item')
  if (tab && !e.target.closest('.button-w')) {
    // matches global.js: clicks inside .button-w are the tab's inner CTA, not a switch
    const heading = tab.querySelector('h1, h2, h3, h4')
    track('tab_switched', {
      tab_label: slug((heading || tab).textContent).slice(0, 80),
      module_name: moduleOf(tab),
      page_path: location.pathname,
    })
    return
  }

  // --- testimonials carousel (repo arrows + Swiper embed arrows) ---
  const arrow = el.closest('[data-next], [data-prev], .slider_button')
  if (arrow) {
    lastArrowAt = Date.now()
    const next = arrow.matches('[data-next], .is--next')
    track('testimonial_carousel_interacted', {
      interaction_type: 'arrow_click',
      direction: next ? 'next' : 'prev',
      page_path: location.pathname,
    })
    return
  }

  // --- pricing plan cards ---
  const card = el.closest('.pricing_item_c')
  if (card && el.tagName === 'A') {
    track('pricing_plan_cta_clicked', {
      plan: card.closest('[data-price-event]')?.dataset.priceEvent || null,
      billing_period: el.closest('.pricing_component')?.dataset.priceStatus || null,
      page_path: location.pathname,
    })
    return
  }

  // trial clicks: head script fires trial_signup_started — don't double as cta_clicked
  if (isTrial(el)) return

  // --- generic in-page CTA ---
  if (el.tagName === 'A' && el.getAttribute('href')) {
    track('cta_clicked', baseProps(el))
  }
}

// HubSpot embed posts hsFormCallback messages on submit. Form isn't built yet —
// confirm the exact field names once it ships.
function initHubspotForm() {
  window.addEventListener('message', (e) => {
    if (e.data?.type !== 'hsFormCallback' || e.data.eventName !== 'onFormSubmit') return
    const fields = e.data.data || []
    const find = (name) => fields.find((f) => f.name === name)
    track('demo_request_submitted', {
      firm_size: find('firm_size')?.value || null,
      has_requirements_text: !!find('requirements')?.value,
      intended_plan: document.querySelector('[data-price-event]')?.dataset.priceEvent || null,
      page_path: location.pathname,
    })
    const email = find('email')?.value
    if (email) {
      window.rudderanalytics?.identify(email, {
        website_reported_firm_size: find('firm_size')?.value || null,
      })
    }
  })
}

// The Swiper testimonial slider is a raw Webflow embed that initializes on its
// own schedule — poll briefly for the instance instead of racing it.
function initSwiperDrag() {
  let tries = 0
  const id = setInterval(() => {
    const swipers = [...document.querySelectorAll('.slider_wrap.swiper')].map((el) => el.swiper).filter(Boolean)
    if (!swipers.length) {
      if (++tries > 20) clearInterval(id)
      return
    }
    clearInterval(id)
    swipers.forEach((sw) =>
      sw.on('slideChange', () => {
        if (Date.now() - lastArrowAt < 300) return // arrow clicks already tracked in handleClick
        track('testimonial_carousel_interacted', {
          interaction_type: 'drag',
          direction: sw.activeIndex > sw.previousIndex ? 'next' : 'prev',
          page_path: location.pathname,
        })
      })
    )
  }, 500)
}

export function initTracking() {
  document.addEventListener('click', handleClick)
  initHubspotForm()
  initSwiperDrag()
}
