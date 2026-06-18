import { splitReveal } from './utils/splitReveal.js'

function initTextAnimations() {
  document.querySelectorAll('[data-split]').forEach((el) => {
    const isHero = el.closest('[data-hero]')

    splitReveal(
      el,
      isHero
        ? {}
        : {
            scrollTrigger: {
              trigger: el,
              start: 'clamp(top 90%)',
              once: true,
            },
          }
    )
  })
}

const initNumbersAnimation = () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const initFlag = 'data-odometer-initialized'
  const activeTweens = new WeakMap()

  // Configuration
  const defaults = {
    duration: 1,
    ease: 'power3.out',
    elementStagger: 0.1,
    digitStagger: 0.04,
    revealDuration: 1,
    revealEase: 'power2.out',
    triggerStart: 'top 100%',
    staggerOrder: 'left',
    digitCycles: 2,
  }

  // Scroll-triggered groups
  document.querySelectorAll('[data-odometer-group]').forEach((group) => {
    if (group.hasAttribute(initFlag)) return
    group.setAttribute(initFlag, '')

    const elements = Array.from(group.querySelectorAll('[data-odometer-element]'))
    if (!elements.length || prefersReducedMotion) return

    const staggerOrder = group.getAttribute('data-odometer-stagger-order') || defaults.staggerOrder
    const triggerStart = group.getAttribute('data-odometer-trigger-start') || defaults.triggerStart
    const elementStagger =
      parseFloat(group.getAttribute('data-odometer-stagger')) || defaults.elementStagger

    const elementData = elements.map((el) => {
      const originalText = el.textContent.trim()
      const hasExplicitStart = el.hasAttribute('data-odometer-start')
      const startValue = parseFloat(el.getAttribute('data-odometer-start')) || 0
      const duration = parseFloat(el.getAttribute('data-odometer-duration')) || defaults.duration
      const step = getLineHeightRatio(el)

      let segments = parseSegments(originalText)
      segments = mapStartDigits(segments, startValue)
      segments = markHiddenSegments(segments, startValue)

      const grow = shouldGrow(el, hasExplicitStart, startValue, segments)
      const { rollers, revealEls } = buildRollerDOM(el, segments, step, grow)

      const fontSize = parseFloat(getComputedStyle(el).fontSize)
      const revealData = revealEls.map((revealEl) => {
        const widthEm = revealEl.offsetWidth / fontSize
        gsap.set(revealEl, { width: 0, overflow: 'hidden' })
        return { el: revealEl, widthEm }
      })

      return { el, rollers, duration, step, revealData, originalText }
    })

    const ordered = applyStaggerOrder(elementData, staggerOrder)

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: group,
        start: triggerStart,
        once: true,
      },
      onComplete() {
        elementData.forEach(({ el, originalText, step }) => {
          cleanupElement(el, originalText)
        })
      },
    })

    ordered.forEach((data, orderIdx) => {
      const { rollers, duration, step, revealData } = data
      const offset = orderIdx * elementStagger

      revealData.forEach(({ el, widthEm }) => {
        tl.to(
          el,
          {
            width: widthEm + 'em',
            opacity: 1,
            duration: defaults.revealDuration,
            ease: defaults.revealEase,
          },
          offset
        )
      })

      rollers.forEach(({ roller, targetPos }, digitIdx) => {
        const reversedIdx = rollers.length - 1 - digitIdx
        tl.to(
          roller,
          {
            y: -targetPos * step + 'em',
            duration,
            ease: defaults.ease,
            force3D: true,
          },
          offset + reversedIdx * defaults.digitStagger
        )
      })
    })
  })

  // Programmatic update (optional add-on)
  return function updateOdometer(el, newText, options = {}) {
    const currentText = el.textContent.trim()
    if (currentText === newText) return

    const duration = options.duration || defaults.duration
    const ease = options.ease || defaults.ease
    const step = getLineHeightRatio(el)

    // Kill any running animation and clear its inline style locks
    const existing = activeTweens.get(el)
    if (existing) {
      existing.kill()
      gsap.set(el, { clearProps: 'width,overflow' })
    }

    // Measure current width before rebuilding (in em for responsive scaling)
    const fontSize = parseFloat(getComputedStyle(el).fontSize)
    const oldWidthEm = el.getBoundingClientRect().width / fontSize

    // Parse current text as start, new text as end
    const startSegments = parseSegments(currentText)
    const startDigitsStr = startSegments
      .filter((s) => s.type === 'digit')
      .map((s) => s.char)
      .join('')
    const startValue = parseInt(startDigitsStr, 10) || 0

    let segments = parseSegments(newText)
    segments = mapStartDigits(segments, startValue)
    segments = markHiddenSegments(segments, startValue)
    const { rollers, revealEls } = buildRollerDOM(el, segments, step, true)

    // Measure new natural width (in em)
    const newWidthEm = el.getBoundingClientRect().width / fontSize
    const widthChanged = Math.abs(oldWidthEm - newWidthEm) > 0.01

    // Lock to old width for smooth transition
    if (widthChanged) {
      gsap.set(el, { width: oldWidthEm + 'em', overflow: 'hidden' })
    }

    const tl = gsap.timeline({
      onComplete() {
        cleanupElement(el, newText)
        activeTweens.delete(el)
      },
    })
    activeTweens.set(el, tl)

    // Animate element width
    if (widthChanged) {
      tl.to(
        el,
        {
          width: newWidthEm + 'em',
          duration: defaults.revealDuration,
          ease: defaults.revealEase,
        },
        0
      )
    }

    // Fade in hidden statics
    revealEls.forEach((revealEl) => {
      if (revealEl.getAttribute('data-odometer-part') === 'static') {
        tl.to(revealEl, { opacity: 1, duration: 0.2 }, 0)
      }
    })

    // Roll digits
    rollers.forEach(({ roller, targetPos }, digitIdx) => {
      const reversedIdx = rollers.length - 1 - digitIdx
      tl.to(
        roller,
        {
          y: -targetPos * step + 'em',
          duration,
          ease,
          force3D: true,
        },
        reversedIdx * defaults.digitStagger
      )
    })
  }

  // Helpers
  function getLineHeightRatio(el) {
    const cs = getComputedStyle(el)
    const lh = cs.lineHeight
    if (lh === 'normal') return 1.2
    return parseFloat(lh) / parseFloat(cs.fontSize)
  }

  function parseSegments(text) {
    return [...text].map((char) => ({
      type: /\d/.test(char) ? 'digit' : 'static',
      char,
    }))
  }

  function mapStartDigits(segments, startValue) {
    const digitSlots = segments.filter((s) => s.type === 'digit')
    const padded = String(Math.floor(Math.abs(startValue)))
      .padStart(digitSlots.length, '0')
      .slice(-digitSlots.length)
    let di = 0
    return segments.map((s) =>
      s.type === 'digit' ? { ...s, startDigit: parseInt(padded[di++], 10) } : s
    )
  }

  function markHiddenSegments(segments, startValue) {
    const totalDigits = segments.filter((s) => s.type === 'digit').length
    const absStart = Math.floor(Math.abs(startValue))
    const startDigitCount = absStart === 0 ? 1 : String(absStart).length
    const leadingZeros = Math.max(0, totalDigits - startDigitCount)
    if (leadingZeros === 0) return segments
    let digitsSeen = 0
    let firstDigitSeen = false
    let prevDigitHidden = false
    return segments.map((seg) => {
      if (seg.type === 'digit') {
        firstDigitSeen = true
        const hidden = digitsSeen < leadingZeros
        prevDigitHidden = hidden
        digitsSeen++
        return { ...seg, hidden }
      }
      const hidden = firstDigitSeen && prevDigitHidden
      return { ...seg, hidden }
    })
  }

  function shouldGrow(el, hasExplicitStart, startValue, segments) {
    if (el.hasAttribute('data-odometer-grow')) {
      return el.getAttribute('data-odometer-grow') !== 'false'
    }
    if (!hasExplicitStart) return false
    const absStart = Math.floor(Math.abs(startValue))
    const startDigitCount = absStart === 0 ? 1 : String(absStart).length
    const endDigitCount = segments.filter((s) => s.type === 'digit').length
    return startDigitCount < endDigitCount
  }

  function buildRollerDOM(el, segments, step, grow) {
    el.innerHTML = ''
    el.style.height = ''
    const rollers = []
    const revealEls = []
    const totalCells = 10 * defaults.digitCycles
    segments.forEach((seg) => {
      if (seg.type === 'static') {
        const span = document.createElement('span')
        span.setAttribute('data-odometer-part', 'static')
        span.style.height = step + 'em'
        span.style.lineHeight = step
        span.textContent = seg.char
        el.appendChild(span)
        if (grow && seg.hidden) {
          gsap.set(span, { opacity: 0 })
          revealEls.push(span)
        }
        return
      }
      const mask = document.createElement('span')
      mask.setAttribute('data-odometer-part', 'mask')
      mask.style.height = step + 'em'
      mask.style.lineHeight = step
      const roller = document.createElement('span')
      roller.setAttribute('data-odometer-part', 'roller')
      roller.style.lineHeight = step

      const digits = []
      for (let d = 0; d < totalCells; d++) {
        digits.push(d % 10)
      }
      roller.textContent = digits.join('\n')
      mask.appendChild(roller)
      el.appendChild(mask)
      const startDigit = seg.startDigit || 0
      const isReveal = grow && seg.hidden
      gsap.set(roller, { y: isReveal ? step + 'em' : -startDigit * step + 'em' })
      const endDigit = parseInt(seg.char, 10)
      const targetPos = endDigit > startDigit ? endDigit : 10 + endDigit
      rollers.push({ roller, targetPos })
      if (isReveal) revealEls.push(mask)
    })
    return { rollers, revealEls }
  }

  function cleanupElement(el, originalText) {
    el.style.overflow = ''
    el.style.height = ''

    // Remove rollers, set final digit, clear inline bloat (but preserve width)
    const digits = [...originalText].filter((c) => /\d/.test(c))
    let di = 0

    el.querySelectorAll('[data-odometer-part="mask"]').forEach((mask) => {
      const roller = mask.querySelector('[data-odometer-part="roller"]')
      if (roller) roller.remove()
      mask.textContent = digits[di++] || ''
      mask.style.opacity = ''
      mask.style.overflow = ''
    })

    el.querySelectorAll('[data-odometer-part="static"]').forEach((stat) => {
      stat.style.opacity = ''
    })
  }

  function recalcOnResize() {
    document.querySelectorAll('[data-odometer-element]').forEach((el) => {
      // Force-complete any running programmatic animation
      const running = activeTweens.get(el)
      if (running) {
        running.progress(1)
        activeTweens.delete(el)
      }

      const hasRollers = el.querySelector('[data-odometer-part="roller"]')

      if (hasRollers) {
        // Pre-triggered: recalculate step-based inline styles
        const step = getLineHeightRatio(el)
        el.querySelectorAll('[data-odometer-part="mask"]').forEach((mask) => {
          mask.style.height = step + 'em'
          mask.style.lineHeight = step
        })
        el.querySelectorAll('[data-odometer-part="roller"]').forEach((roller) => {
          roller.style.lineHeight = step
        })
        el.querySelectorAll('[data-odometer-part="static"]').forEach((stat) => {
          stat.style.lineHeight = step
        })
      }
      // Completed elements: width is em-based, scales automatically, don't touch
    })
    ScrollTrigger.refresh()
  }

  let resizeTimer
  let lastWidth = window.innerWidth
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (window.innerWidth === lastWidth) return
      lastWidth = window.innerWidth
      recalcOnResize()
    }, 250)
  })

  function applyStaggerOrder(items, order) {
    const arr = [...items]
    if (order === 'right') return arr.reverse()
    if (order === 'random') return shuffleArray(arr)
    return arr
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
}

function initMegaNavDirectionalHover() {
  const DUR = {
    bgMorph: 0.4,
    contentIn: 0.3,
    contentOut: 0.2,
    stagger: 0.25,
    backdropIn: 0.3,
    backdropOut: 0.2,
    openScale: 0.35,
    closeScale: 0.25,
  }

  const HOVER_ENTER = 120
  const HOVER_LEAVE = 150

  // DOM references
  const menuWrap = document.querySelector('[data-menu-wrap]')
  const navList = document.querySelector('[data-nav-list]')
  const dropWrapper = document.querySelector('[data-dropdown-wrapper]')
  const dropContainer = document.querySelector('[data-dropdown-container]')
  const dropBg = document.querySelector('[data-dropdown-bg]')
  const backdrop = document.querySelector('[data-menu-backdrop]')
  const toggles = [...document.querySelectorAll('[data-dropdown-toggle]')]
  const panels = [...document.querySelectorAll('[data-nav-content]')]
  const burger = document.querySelector('[data-burger-toggle]')
  const backBtn = document.querySelector('[data-mobile-back]')
  const logo = document.querySelector('[data-menu-logo]')
  const [lineTop, lineMid, lineBot] = ['top', 'mid', 'bot'].map((id) =>
    document.querySelector(`[data-burger-line='${id}']`)
  )

  // State
  const state = {
    isOpen: false,
    activePanel: null,
    activePanelIndex: -1,
    isMobile: window.innerWidth <= 991,
    mobileMenuOpen: false,
    mobilePanelActive: null,
    hoverTimer: null,
    leaveTimer: null,
    tl: null,
    mobileTl: null,
    mobilePanelTl: null,
  }

  // Helpers
  const getPanel = (name) => document.querySelector(`[data-nav-content="${name}"]`)
  const getToggle = (name) => document.querySelector(`[data-dropdown-toggle="${name}"]`)
  const getFade = (el) => el.querySelectorAll('[data-menu-fade]')
  const getNavItems = () => navList.querySelectorAll('[data-nav-list-item]')
  const getIndex = (name) => toggles.indexOf(getToggle(name))
  const stagger = (n) => (n <= 1 ? 0 : { amount: DUR.stagger })

  function clearTimers() {
    clearTimeout(state.hoverTimer)
    clearTimeout(state.leaveTimer)
    state.hoverTimer = state.leaveTimer = null
  }

  function killTl(key) {
    if (state[key]) {
      state[key].kill()
      state[key] = null
    }
  }

  function killDropdown() {
    killTl('tl')
    gsap.killTweensOf(dropContainer)
    gsap.killTweensOf(backdrop)
    panels.forEach((p) => {
      gsap.killTweensOf(p)
      gsap.killTweensOf(getFade(p))
    })
  }

  function killMobile() {
    killTl('mobileTl')
    gsap.killTweensOf([navList, lineTop, lineMid, lineBot])
  }

  function killMobilePanel() {
    killTl('mobilePanelTl')
    gsap.killTweensOf(getNavItems())
    gsap.killTweensOf([backBtn, logo])
    panels.forEach((p) => {
      gsap.killTweensOf(p)
      gsap.killTweensOf(getFade(p))
    })
  }

  function resetToggles() {
    toggles.forEach((t) => t.setAttribute('aria-expanded', 'false'))
  }

  function resetDesktop() {
    panels.forEach((p) => {
      gsap.set(p, {
        visibility: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
        x: 0,
        y: 0,
        xPercent: 0,
      })
      gsap.set(getFade(p), { autoAlpha: 0, x: 0, y: 0, xPercent: 0 })
    })

    gsap.set(dropContainer, { height: 0, clearProps: 'transform' })
    gsap.set(backdrop, { autoAlpha: 0 })

    menuWrap.setAttribute('data-menu-open', 'false')
    resetToggles()
  }

  function setupMobile() {
    panels.forEach((p) => {
      gsap.set(p, { autoAlpha: 0, xPercent: 0, visibility: 'visible', pointerEvents: 'none' })
      gsap.set(getFade(p), { xPercent: 20, autoAlpha: 0 })
    })
    gsap.set(getNavItems(), { xPercent: 0, y: 0, autoAlpha: 1 })
    gsap.set(navList, { autoAlpha: 0, x: 0 })
    gsap.set(backBtn, { autoAlpha: 0 })
    gsap.set(logo, { autoAlpha: 1 })
    gsap.set(dropContainer, { clearProps: 'height' })
    gsap.set(backdrop, { autoAlpha: 0 })
  }

  function measurePanel(name) {
    const el = getPanel(name)
    if (!el) return 0
    const s = el.style
    const prev = [s.visibility, s.opacity, s.pointerEvents]
    Object.assign(s, { visibility: 'visible', opacity: '0', pointerEvents: 'none' })
    const h = el.getBoundingClientRect().height
    ;[s.visibility, s.opacity, s.pointerEvents] = prev
    return h
  }

  // DESKTOP — open dropdown (first open)
  function openDropdown(panelName) {
    if (state.isOpen && state.activePanel === panelName) return
    if (state.isOpen) return switchPanel(state.activePanel, panelName)

    const height = measurePanel(panelName)
    if (!height) return

    killDropdown()
    resetDesktop()

    const el = getPanel(panelName)
    const fade = getFade(el)
    const toggle = getToggle(panelName)

    state.isOpen = true
    state.activePanel = panelName
    state.activePanelIndex = getIndex(panelName)
    menuWrap.setAttribute('data-menu-open', 'true')
    if (toggle) toggle.setAttribute('aria-expanded', 'true')

    gsap.set(dropContainer, { height: 0 })

    const tl = gsap.timeline()
    state.tl = tl
    tl.to(backdrop, { autoAlpha: 1, duration: DUR.backdropIn, ease: 'power2.out' }, 0)
    tl.to(dropContainer, { height, duration: DUR.openScale, ease: 'power3.out' }, 0)
    tl.set(el, { visibility: 'visible', opacity: 1, pointerEvents: 'auto' }, 0.05)
    if (fade.length) {
      tl.fromTo(
        fade,
        { autoAlpha: 0, y: 8 },
        {
          autoAlpha: 1,
          y: 0,
          duration: DUR.contentIn,
          stagger: stagger(fade.length),
          ease: 'power3.out',
        },
        0.1
      )
    }
  }

  // DESKTOP — close dropdown
  function closeDropdown() {
    if (!state.isOpen) return
    const el = getPanel(state.activePanel)
    const fade = el ? getFade(el) : []

    killDropdown()

    const tl = gsap.timeline({
      onComplete() {
        state.isOpen = false
        state.activePanel = null
        state.activePanelIndex = -1
        state.tl = null
        resetDesktop()
      },
    })
    state.tl = tl
    if (fade.length)
      tl.to(fade, { autoAlpha: 0, y: -4, duration: DUR.contentOut * 0.7, ease: 'power2.in' }, 0)
    tl.to(dropContainer, { height: 0, duration: DUR.closeScale, ease: 'power2.in' }, 0.05)
    tl.to(backdrop, { autoAlpha: 0, duration: DUR.backdropOut, ease: 'power2.out' }, 0)
    if (el) tl.set(el, { visibility: 'hidden', opacity: 0, pointerEvents: 'none' })
  }

  // DESKTOP — switch panel (directional)
  function switchPanel(fromName, toName) {
    const dir = getIndex(toName) > getIndex(fromName) ? 1 : -1
    const fromEl = getPanel(fromName),
      toEl = getPanel(toName)
    if (!fromEl || !toEl) return

    const fromFade = getFade(fromEl),
      toFade = getFade(toEl)
    const toHeight = measurePanel(toName)
    if (!toHeight) return

    killDropdown()

    // Reset all panels, then restore fromEl as visible
    panels.forEach((p) => {
      gsap.set(p, { visibility: 'hidden', opacity: 0, pointerEvents: 'none', xPercent: 0 })
      gsap.set(getFade(p), { autoAlpha: 0, x: 0, y: 0 })
    })
    gsap.set(fromEl, { visibility: 'visible', opacity: 1, pointerEvents: 'auto', x: 0 })
    if (fromFade.length) gsap.set(fromFade, { autoAlpha: 1, x: 0, y: 0 })
    gsap.set(backdrop, { autoAlpha: 1 })

    const toToggle = getToggle(toName)
    state.activePanel = toName
    state.activePanelIndex = getIndex(toName)
    resetToggles()
    if (toToggle) toToggle.setAttribute('aria-expanded', 'true')

    const xOut = dir * -30,
      xIn = dir * 30
    const tl = gsap.timeline()
    state.tl = tl

    if (fromFade.length)
      tl.to(fromFade, { autoAlpha: 0, x: xOut, duration: DUR.contentOut, ease: 'power2.in' }, 0)
    tl.set(
      fromEl,
      { visibility: 'hidden', opacity: 0, pointerEvents: 'none', xPercent: 0 },
      DUR.contentOut
    )
    if (fromFade.length) tl.set(fromFade, { x: 0 }, DUR.contentOut)
    tl.to(dropContainer, { height: toHeight, duration: DUR.bgMorph, ease: 'power3.out' }, 0.05)
    tl.set(
      toEl,
      { visibility: 'visible', opacity: 1, pointerEvents: 'auto', xPercent: 0 },
      DUR.contentOut * 0.5
    )
    if (toFade.length) {
      tl.fromTo(
        toFade,
        { autoAlpha: 0, x: xIn },
        {
          autoAlpha: 1,
          x: 0,
          duration: DUR.contentIn,
          stagger: stagger(toFade.length),
          ease: 'power3.out',
        },
        DUR.contentOut * 0.6
      )
    }
  }

  // DESKTOP — hover intent
  function handleToggleEnter(e) {
    if (state.isMobile) return
    const name = e.currentTarget.getAttribute('data-dropdown-toggle')
    if (!name) return
    clearTimeout(state.leaveTimer)
    state.leaveTimer = null
    clearTimeout(state.hoverTimer)
    state.hoverTimer = setTimeout(() => openDropdown(name), state.isOpen ? 0 : HOVER_ENTER)
  }

  function handleToggleLeave() {
    if (state.isMobile) return
    clearTimeout(state.hoverTimer)
    state.hoverTimer = null
    state.leaveTimer = setTimeout(closeDropdown, HOVER_LEAVE)
  }

  function handleWrapperEnter() {
    if (state.isMobile) return
    clearTimeout(state.leaveTimer)
    state.leaveTimer = null
  }

  function handleWrapperLeave() {
    if (state.isMobile) return
    state.leaveTimer = setTimeout(closeDropdown, HOVER_LEAVE)
  }

  // DESKTOP — close behaviors
  function handleEscape(e) {
    if (e.key !== 'Escape') return
    if (state.isMobile) {
      state.mobilePanelActive ? closeMobilePanel() : state.mobileMenuOpen && closeMobileMenu()
      return
    }
    if (state.isOpen) {
      const t = getToggle(state.activePanel)
      closeDropdown()
      if (t) t.focus()
    }
  }

  function handleDocClick(e) {
    if (state.isMobile || !state.isOpen) return
    if (!e.target.closest('[data-menu-wrap]')) closeDropdown()
  }

  // DESKTOP — keyboard navigation
  function focusFirstLink(panelName) {
    setTimeout(() => {
      const el = getPanel(panelName)
      if (!el) return
      const link = el.querySelector('a')
      if (!link) return
      gsap.set(link, { visibility: 'visible' })
      link.focus()
    }, 80)
  }

  function handleKeydownOnToggle(e) {
    if (state.isMobile) return
    const name = e.currentTarget.getAttribute('data-dropdown-toggle')

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (state.isOpen && state.activePanel === name) closeDropdown()
      else {
        openDropdown(name)
        focusFirstLink(name)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!state.isOpen || state.activePanel !== name) openDropdown(name)
      focusFirstLink(name)
    }
    if (e.key === 'Tab' && !e.shiftKey && state.isOpen && state.activePanel === name) {
      e.preventDefault()
      const link = getPanel(name)?.querySelector('a')
      if (link) link.focus()
    }
  }

  function handleKeydownInPanel(e) {
    if (state.isMobile || !state.isOpen) return
    const el = getPanel(state.activePanel)
    if (!el) return

    const links = [...el.querySelectorAll('a')]
    const idx = links.indexOf(document.activeElement)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      links[(idx + 1) % links.length].focus()
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (idx <= 0) {
        const t = getToggle(state.activePanel)
        if (t) t.focus()
      } else links[idx - 1].focus()
    }
    if (e.key === 'Tab' && !e.shiftKey && idx === links.length - 1) {
      e.preventDefault()
      const curIdx = toggles.indexOf(getToggle(state.activePanel))
      const next = curIdx < toggles.length - 1 ? toggles[curIdx + 1] : null
      closeDropdown()
      if (next) next.focus()
    }
    if (e.key === 'Tab' && e.shiftKey && idx === 0) {
      e.preventDefault()
      const t = getToggle(state.activePanel)
      if (t) t.focus()
    }
  }

  // MOBILE — burger animation
  function animateBurger(toX) {
    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } })
    if (toX) {
      tl.to(lineTop, { y: '0.3125em', duration: 0.15 }, 0)
      tl.to(lineBot, { y: '-0.3125em', duration: 0.15 }, 0)
      tl.to(lineMid, { autoAlpha: 0, duration: 0.1 }, 0.1)
      tl.to(lineTop, { rotation: 45, duration: 0.2 }, 0.15)
      tl.to(lineBot, { rotation: -45, duration: 0.2 }, 0.15)
    } else {
      tl.to(lineTop, { rotation: 0, duration: 0.2 }, 0)
      tl.to(lineBot, { rotation: 0, duration: 0.2 }, 0)
      tl.to(lineTop, { y: 0, duration: 0.15 }, 0.15)
      tl.to(lineBot, { y: 0, duration: 0.15 }, 0.15)
      tl.to(lineMid, { autoAlpha: 1, duration: 0.1 }, 0.15)
    }
    return tl
  }

  // MOBILE — open/close menu
  function openMobileMenu() {
    killMobile()
    state.mobileMenuOpen = true
    menuWrap.setAttribute('data-menu-open', 'true')
    burger.setAttribute('aria-expanded', 'true')
    document.body.style.overflow = 'hidden'

    const items = getNavItems()
    const tl = gsap.timeline()
    state.mobileTl = tl
    tl.add(animateBurger(true), 0)
    tl.to(navList, { autoAlpha: 1, duration: 0.3, ease: 'power2.out' }, 0)
    if (items.length) {
      tl.fromTo(
        items,
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.04, ease: 'power3.out' },
        0.15
      )
    }
  }

  function closeMobileMenu() {
    const hadPanel = state.mobilePanelActive
    const panelEl = hadPanel ? getPanel(hadPanel) : null

    killMobile()
    killMobilePanel()

    menuWrap.setAttribute('data-menu-open', 'false')
    state.mobileMenuOpen = false
    state.mobilePanelActive = null
    burger.setAttribute('aria-expanded', 'false')

    const tl = gsap.timeline({
      onComplete() {
        document.body.style.overflow = ''
        state.mobileTl = null
        setupMobile()
      },
    })
    state.mobileTl = tl

    tl.add(animateBurger(false), 0)

    // If a panel was open, fade it out with the close — no snap reset
    if (hadPanel && panelEl) {
      tl.to(panelEl, { autoAlpha: 0, duration: 0.3, ease: 'power2.inOut' }, 0.05)
      tl.to(backBtn, { autoAlpha: 0, duration: 0.2, ease: 'power2.in' }, 0.05)
    }

    // Fade out the nav list container
    tl.to(navList, { autoAlpha: 0, duration: 0.3, ease: 'power2.inOut' }, 0.05)
  }

  // MOBILE — slide-over panels
  function openMobilePanel(panelName) {
    const el = getPanel(panelName)
    if (!el) return
    killMobilePanel()
    state.mobilePanelActive = panelName

    const navItems = getNavItems()
    const panelFade = getFade(el)

    const tl = gsap.timeline()
    state.mobilePanelTl = tl

    // Fade out each nav item to the left
    if (navItems.length) {
      tl.to(
        navItems,
        {
          xPercent: -10,
          autoAlpha: 0,
          duration: 0.35,
          stagger: 0.03,
          ease: 'power2.in',
        },
        0
      )
    }

    // Logo → back button swap
    tl.to(logo, { autoAlpha: 0, duration: 0.2, ease: 'power2.in' }, 0)
    tl.to(backBtn, { autoAlpha: 1, duration: 0.25, ease: 'power2.inOut' }, 0.15)

    // Show panel container, then fade in its items from the right
    tl.set(el, { autoAlpha: 1, xPercent: 0, pointerEvents: 'auto' }, 0.2)
    if (panelFade.length) {
      tl.fromTo(
        panelFade,
        { xPercent: 8, autoAlpha: 0 },
        {
          xPercent: 0,
          autoAlpha: 1,
          duration: 0.3,
          stagger: stagger(panelFade.length),
          ease: 'power3.out',
        },
        0.25
      )
    }
  }

  function closeMobilePanel() {
    if (!state.mobilePanelActive) return
    const el = getPanel(state.mobilePanelActive)
    if (!el) return
    killMobilePanel()

    const navItems = getNavItems()
    const panelFade = getFade(el)

    const tl = gsap.timeline({
      onComplete() {
        state.mobilePanelActive = null
        state.mobilePanelTl = null
      },
    })
    state.mobilePanelTl = tl

    // Fade out panel items to the right
    if (panelFade.length) {
      tl.to(
        el,
        {
          xPercent: 20,
          autoAlpha: 0,
          duration: 0.3,
          stagger: 0.02,
          ease: 'power2.in',
        },
        0
      )
    }

    // Hide panel
    tl.set(el, { autoAlpha: 0, pointerEvents: 'none' }, 0.25)

    // Back → logo swap
    tl.to(backBtn, { autoAlpha: 0, duration: 0.2, ease: 'power2.in' }, 0)
    tl.to(logo, { autoAlpha: 1, duration: 0.25, ease: 'power2.out' }, 0.15)

    // Fade nav items back in from center
    if (navItems.length) {
      tl.fromTo(
        navItems,
        { xPercent: -20, autoAlpha: 0 },
        { xPercent: 0, autoAlpha: 1, duration: 0.35, stagger: 0.03, ease: 'power3.out' },
        0.25
      )
    }
  }

  function handleToggleClick(e) {
    if (!state.isMobile || !state.mobileMenuOpen) return
    const name = e.currentTarget.getAttribute('data-dropdown-toggle')
    if (name) {
      e.preventDefault()
      openMobilePanel(name)
    }
  }

  // RESIZE
  let resizeTimer = null
  let lastWidth = window.innerWidth
  function handleResize() {
    const w = window.innerWidth
    if (w === lastWidth) return
    lastWidth = w
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      const was = state.isMobile
      state.isMobile = window.innerWidth <= 991

      if (was && !state.isMobile) {
        killMobile()
        killMobilePanel()
        gsap.set(navList, { clearProps: 'all' })
        gsap.set(getNavItems(), { clearProps: 'all' })
        gsap.set(backBtn, { autoAlpha: 0 })
        gsap.set(logo, { clearProps: 'all' })
        gsap.set([lineTop, lineMid, lineBot], { rotation: 0, y: 0, autoAlpha: 1 })

        panels.forEach((p) => {
          gsap.set(p, { clearProps: 'all' })
          gsap.set(getFade(p), { clearProps: 'all' })
        })

        burger.setAttribute('aria-expanded', 'false')
        state.mobileMenuOpen = false
        state.mobilePanelActive = null
        document.body.style.overflow = ''
        resetDesktop()
      }

      if (!was && state.isMobile) {
        killDropdown()
        state.isOpen = false
        state.activePanel = null
        state.activePanelIndex = -1
        clearTimers()
        menuWrap.setAttribute('data-menu-open', 'false')
        resetToggles()
        setupMobile()
      }
    }, 150)
  }

  // EVENT BINDING
  toggles.forEach((btn) => {
    btn.addEventListener('mouseenter', handleToggleEnter)
    btn.addEventListener('mouseleave', handleToggleLeave)
    btn.addEventListener('keydown', handleKeydownOnToggle)
    btn.addEventListener('click', handleToggleClick)
  })

  dropWrapper.addEventListener('mouseenter', handleWrapperEnter)
  dropWrapper.addEventListener('mouseleave', handleWrapperLeave)

  panels.forEach((p) => p.addEventListener('keydown', handleKeydownInPanel))

  backdrop.addEventListener('click', closeDropdown)

  document.addEventListener('keydown', handleEscape)
  document.addEventListener('click', handleDocClick)

  burger.addEventListener('click', () =>
    state.mobileMenuOpen ? closeMobileMenu() : openMobileMenu()
  )

  backBtn.addEventListener('click', closeMobilePanel)

  window.addEventListener('resize', handleResize)

  // INIT
  state.isMobile ? setupMobile() : resetDesktop()
}

function initMarqueeScrollDirection(container = document) {
  container.querySelectorAll('[data-marquee-scroll-direction-target]').forEach((marquee) => {
    // Query marquee elements
    const marqueeContent = marquee.querySelector('[data-marquee-collection-target]')
    const marqueeScroll = marquee.querySelector('[data-marquee-scroll-target]')
    if (!marqueeContent || !marqueeScroll) return

    // Get data attributes
    const {
      marqueeSpeed: speed,
      marqueeDirection: direction,
      marqueeDuplicate: duplicate,
      marqueeScrollSpeed: scrollSpeed,
    } = marquee.dataset

    // Convert data attributes to usable types
    const marqueeSpeedAttr = parseFloat(speed)
    const marqueeDirectionAttr = direction === 'right' ? 1 : -1 // 1 for right, -1 for left
    const duplicateAmount = parseInt(duplicate || 0)
    const scrollSpeedAttr = parseFloat(scrollSpeed)
    const speedMultiplier = window.innerWidth < 479 ? 0.25 : window.innerWidth < 991 ? 0.5 : 1

    const marqueeSpeed =
      marqueeSpeedAttr * (marqueeContent.offsetWidth / window.innerWidth) * speedMultiplier

    // Precompute styles for the scroll container
    marqueeScroll.style.marginLeft = `${scrollSpeedAttr * -1}%`
    marqueeScroll.style.width = `${scrollSpeedAttr * 2 + 100}%`

    // Duplicate marquee content
    if (duplicateAmount > 0) {
      const fragment = document.createDocumentFragment()
      for (let i = 0; i < duplicateAmount; i++) {
        fragment.appendChild(marqueeContent.cloneNode(true))
      }
      marqueeScroll.appendChild(fragment)
    }

    // GSAP animation for marquee content
    const marqueeItems = marquee.querySelectorAll('[data-marquee-collection-target]')
    const animation = gsap
      .to(marqueeItems, {
        xPercent: -100, // Move completely out of view
        repeat: -1,
        duration: marqueeSpeed,
        ease: 'linear',
      })
      .totalProgress(0.5)

    // Initialize marquee in the correct direction
    gsap.set(marqueeItems, { xPercent: marqueeDirectionAttr === 1 ? 100 : -100 })
    animation.timeScale(marqueeDirectionAttr) // Set correct direction
    animation.play() // Start animation immediately

    // Set initial marquee status
    marquee.setAttribute('data-marquee-status', 'normal')

    // ScrollTrigger logic for direction inversion
    ScrollTrigger.create({
      trigger: marquee,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        const isInverted = self.direction === 1 // Scrolling down
        const currentDirection = isInverted ? -marqueeDirectionAttr : marqueeDirectionAttr

        // Update animation direction and marquee status
        animation.timeScale(currentDirection)
        marquee.setAttribute('data-marquee-status', isInverted ? 'normal' : 'inverted')
      },
    })

    // Extra speed effect on scroll
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: marquee,
        start: '0% 100%',
        end: '100% 0%',
        scrub: 0,
      },
    })

    const scrollStart = marqueeDirectionAttr === -1 ? scrollSpeedAttr : -scrollSpeedAttr
    const scrollEnd = -scrollStart

    tl.fromTo(marqueeScroll, { x: `${scrollStart}vw` }, { x: `${scrollEnd}vw`, ease: 'none' })
  })
}

function initButton() {
  const buttons = document.querySelectorAll('[data-button]')
  if (buttons.length === 0) return

  buttons.forEach((element) => {
    const textElement = element.querySelector('[data-button-text]')
    const widthHover = Number(element.getAttribute('data-button-width-hover')) || 0
    const heightHover = Number(element.getAttribute('data-button-height-hover')) || 0
    if (!textElement) return

    const setScale = (x, y) => {
      element.style.setProperty('--button-scale-x', x)
      element.style.setProperty('--button-scale-y', y)
    }

    const updateScale = () => {
      const currentWidth = element.offsetWidth
      const currentHeight = element.offsetHeight
      const scaleX = (currentWidth + widthHover) / currentWidth
      const scaleY = (currentHeight + heightHover) / currentHeight
      setScale(scaleX, scaleY)
    }

    updateScale()
    const text = textElement.textContent
    textElement.innerHTML = ''
    ;[...text].forEach((char, index) => {
      const span = document.createElement('span')
      span.textContent = char
      span.style.setProperty('--index', index)

      if (char === ' ') {
        span.style.whiteSpace = 'pre'
      }

      textElement.appendChild(span)
    })
  })
}

function initLineRevealTestimonials() {
  const wraps = document.querySelectorAll('[data-testimonial-wrap]')
  if (!wraps.length) return

  const imageClipHidden = 'circle(0% at 50% 50%)'
  const imageClipVisible = 'circle(50% at 50% 50%)'

  wraps.forEach((wrap) => {
    const list = wrap.querySelector('[data-testimonial-list]')
    if (!list) return

    const items = Array.from(list.querySelectorAll('[data-testimonial-item]'))
    if (!items.length) return

    const btnPrev = wrap.querySelector('[data-prev]')
    const btnNext = wrap.querySelector('[data-next]')
    const elCurrent = wrap.querySelector('[data-current]')
    const elTotal = wrap.querySelector('[data-total]')

    if (elTotal) elTotal.textContent = String(items.length)

    let activeIndex = items.findIndex((el) => el.classList.contains('is--active'))
    if (activeIndex < 0) activeIndex = 0

    let isAnimating = false
    let reduceMotion = false

    const autoplayEnabled = wrap.getAttribute('data-autoplay') === 'true'
    const autoplayDuration = parseInt(wrap.getAttribute('data-autoplay-duration'), 10) || 4000

    let autoplayCall = null
    let isInView = true

    const slides = items.map((item) => ({
      item,
      image: item.querySelector('[data-testimonial-img]'),

      splitTargets: [
        item.querySelector('[data-testimonial-text]'),
        ...item.querySelectorAll('[data-testimonial-split]'),
      ].filter(Boolean),

      splitInstances: [],

      getLines() {
        return this.splitInstances.flatMap((instance) => instance.lines)
      },
    }))

    function setSlideState(slideIndex, isActive) {
      const { item } = slides[slideIndex]
      item.classList.toggle('is--active', isActive)
      item.setAttribute('aria-hidden', String(!isActive))
      gsap.set(item, {
        autoAlpha: isActive ? 1 : 0,
        pointerEvents: isActive ? 'auto' : 'none',
      })
    }

    function updateCounter() {
      if (elCurrent) elCurrent.textContent = String(activeIndex + 1)
    }

    function startAutoplay() {
      if (!autoplayEnabled) return
      if (autoplayCall) autoplayCall.kill()

      autoplayCall = gsap.delayedCall(autoplayDuration / 1000, () => {
        if (!isInView || isAnimating) {
          startAutoplay()
          return
        }
        goTo((activeIndex + 1) % slides.length)
        startAutoplay()
      })
    }

    function pauseAutoplay() {
      if (autoplayCall) autoplayCall.pause()
    }

    function resumeAutoplay() {
      if (!autoplayEnabled) return
      if (!autoplayCall) startAutoplay()
      else autoplayCall.resume()
    }

    function resetAutoplay() {
      if (!autoplayEnabled) return
      startAutoplay()
    }

    // Set initial state
    slides.forEach((_, i) => setSlideState(i, i === activeIndex))
    updateCounter()

    // Handle reduced motion preference
    gsap.matchMedia().add({ reduce: '(prefers-reduced-motion: reduce)' }, (context) => {
      reduceMotion = context.conditions.reduce
    })

    // Create SplitText instances
    slides.forEach((slide, slideIndex) => {
      slide.splitInstances = slide.splitTargets.map((el) =>
        SplitText.create(el, {
          type: 'lines',
          mask: 'lines',
          linesClass: 'text-line',
          autoSplit: true,
          onSplit(self) {
            if (reduceMotion) return

            const isActive = slideIndex === activeIndex
            gsap.set(self.lines, { yPercent: isActive ? 0 : 110 })

            if (slide.image) {
              gsap.set(slide.image, {
                clipPath: isActive ? imageClipVisible : imageClipHidden,
              })
            }
          },
        })
      )
    })

    function goTo(nextIndex) {
      if (isAnimating || nextIndex === activeIndex) return
      isAnimating = true

      const outgoingSlide = slides[activeIndex]
      const incomingSlide = slides[nextIndex]

      const tl = gsap.timeline({
        onComplete: () => {
          setSlideState(activeIndex, false)
          setSlideState(nextIndex, true)
          activeIndex = nextIndex
          updateCounter()
          isAnimating = false
        },
      })

      if (reduceMotion) {
        tl.to(
          outgoingSlide.item,
          {
            autoAlpha: 0,
            duration: 0.4,
            ease: 'power2',
          },
          0
        ).fromTo(
          incomingSlide.item,
          {
            autoAlpha: 0,
          },
          {
            autoAlpha: 1,
            duration: 0.4,
            ease: 'power2',
          },
          0
        )

        return
      }

      const outgoingLines = outgoingSlide.getLines()
      const incomingLines = incomingSlide.getLines()

      gsap.set(incomingSlide.item, { autoAlpha: 1, pointerEvents: 'auto' })
      gsap.set(incomingLines, { yPercent: 110 })

      if (outgoingSlide.image) gsap.set(outgoingSlide.image, { clipPath: imageClipVisible })

      tl.to(
        outgoingLines,
        {
          yPercent: -110,
          duration: 0.6,
          ease: 'power4.inOut',
          stagger: { amount: 0.1 },
        },
        0
      )

      if (outgoingSlide.image) {
        tl.to(
          outgoingSlide.image,
          {
            clipPath: imageClipHidden,
            duration: 0.6,
            ease: 'power4.inOut',
          },
          0
        )
      }

      tl.to(
        incomingLines,
        {
          yPercent: 0,
          duration: 0.6,
          ease: 'power3.out',
          stagger: { amount: 0.1 },
        },
        '>-=0.3'
      )

      if (incomingSlide.image) {
        tl.fromTo(
          incomingSlide.image,
          {
            clipPath: imageClipHidden,
          },
          {
            clipPath: imageClipVisible,
            duration: 0.75,
            ease: 'power4.inOut',
          },
          '<'
        )
      }

      tl.set(outgoingSlide.item, { autoAlpha: 0 }, '>')
    }

    // Start autoplay on the wrap (only works if autoplay is set to 'true')
    startAutoplay()

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        resetAutoplay()
        goTo((activeIndex + 1) % slides.length)
      })
    }

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        resetAutoplay()
        goTo((activeIndex - 1 + slides.length) % slides.length)
      })
    }

    function onKeyDown(e) {
      if (!isInView) return

      // Don't hijack arrow keys while user is typing.
      const t = e.target
      const isTypingTarget =
        t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

      if (isTypingTarget) return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        resetAutoplay()
        goTo((activeIndex + 1) % slides.length)
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        resetAutoplay()
        goTo((activeIndex - 1 + slides.length) % slides.length)
      }
    }

    // Listen for left/right arrows
    window.addEventListener('keydown', onKeyDown)

    // Enable/disable keyboard + autoplay depending on scroll position
    ScrollTrigger.create({
      trigger: wrap,
      start: 'top bottom',
      end: 'bottom top',
      onEnter: () => {
        isInView = true
        resumeAutoplay()
      },
      onEnterBack: () => {
        isInView = true
        resumeAutoplay()
      },
      onLeave: () => {
        isInView = false
        pauseAutoplay()
      },
      onLeaveBack: () => {
        isInView = false
        pauseAutoplay()
      },
    })
  })
}

const initFaqs = () => {
  document.querySelectorAll('.accordion_component').forEach((component, listIndex) => {
    if (component.hasAttribute('data-accordion')) return
    component.setAttribute('data-accordion', '')

    let previousIndex = null,
      closeFunctions = []

    component.querySelectorAll('.accordion_item').forEach((card, cardIndex) => {
      const button = card.querySelector('.accordion_button')
      const content = card.querySelector('.accordion_content')
      if (!button || !content) return

      const id = `accordion-${listIndex}-${cardIndex}`
      button.id = `${id}-button`
      button.setAttribute('aria-controls', `${id}-content`)
      button.setAttribute('aria-expanded', 'false')
      content.id = `${id}-content`
      content.style.display = 'none'
      content.setAttribute('aria-labelledby', button.id)

      gsap.context(() => {
        const tl = gsap.timeline({
          paused: true,
          defaults: { duration: 0.45, ease: 'power2.inOut' },
          onComplete: () => (typeof ScrollTrigger !== 'undefined' ? ScrollTrigger.refresh() : null),
          onReverseComplete: () =>
            typeof ScrollTrigger !== 'undefined' ? ScrollTrigger.refresh() : null,
        })
        tl.set(content, { display: 'block' })
        tl.fromTo(content, { height: 0 }, { height: 'auto' })
        tl.fromTo('.accordion_icon', { rotate: 0 }, { rotate: -180 }, '<')

        function close() {
          if (button.ariaExpanded === 'false') return
          button.ariaExpanded = 'false'
          previousIndex = null
          tl.reverse().invalidate()
        }
        closeFunctions[cardIndex] = close

        function open(instant) {
          if (previousIndex !== null && previousIndex !== cardIndex)
            closeFunctions[previousIndex]?.()
          previousIndex = cardIndex
          button.ariaExpanded = 'true'
          instant ? tl.progress(1) : tl.play()
        }

        button.addEventListener('click', () => (button.ariaExpanded === 'true' ? close() : open()))
      }, card)
    })
  })
}

const initHighlightText = () => {
  document.querySelectorAll('[data-highlight-text]').forEach((el) => {
    const scrollStart = el.getAttribute('data-highlight-scroll-start') || 'top 100%'
    const scrollEnd = el.getAttribute('data-highlight-scroll-end') || 'center 40%'
    const fadeOpacity = parseFloat(el.getAttribute('data-highlight-fade')) || 0.2
    const charStagger = parseFloat(el.getAttribute('data-highlight-stagger')) || 0.1
    const lineStagger = parseFloat(el.getAttribute('data-highlight-line-stagger')) || 0.3

    new SplitText(el, {
      type: 'lines, words, chars',
      autoSplit: true,
      onSplit(split) {
        return gsap.context(() => {
          const charsByLine = split.lines.map((line) =>
            split.chars.filter((char) => line.contains(char))
          )

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: el,
              start: scrollStart,
              end: scrollEnd,
              scrub: true,
            },
          })

          charsByLine.forEach((chars, lineIndex) => {
            tl.from(
              chars,
              { autoAlpha: fadeOpacity, stagger: charStagger, ease: 'linear' },
              lineIndex * lineStagger
            )
          })
        })
      },
    })
  })
}

export function initGlobal() {
  initTextAnimations()
  initHighlightText()
  initMarqueeScrollDirection()

  initNumbersAnimation()
  initButton()

  initLineRevealTestimonials()

  initMegaNavDirectionalHover()
  initFaqs()
}
