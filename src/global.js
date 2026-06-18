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

export function initGlobal() {
  initTextAnimations()
  initMarqueeScrollDirection()

  initNumbersAnimation()
  initButton()

  initLineRevealTestimonials()
}
