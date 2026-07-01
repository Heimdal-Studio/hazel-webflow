import { MQ } from './utils/breakpoints.js'
import { splitReveal } from './utils/splitReveal.js'

CustomEase.create('hazel-ease', 'M0,0 C0.0846,-0.0003 0,1 1,1')

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
    const marqueeSpeedAttr = parseFloat(speed) || 30
    const marqueeDirectionAttr = direction === 'right' ? 1 : -1 // 1 for right, -1 for left
    const duplicateAmount = parseInt(duplicate || 0)
    const scrollSpeedAttr = parseFloat(scrollSpeed) || 1
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

/*
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
*/

function initButton(container = document) {
  const offsetIncrement = 0.01
  const isTabletOrBelow = window.matchMedia('(max-width: 991px)').matches
  const buttons = container.querySelectorAll('[data-button-text]')

  buttons.forEach((button) => {
    if (button._buttonHoverInit) return
    if (isTabletOrBelow && button.dataset.buttonText === 'disable-tablet') return
    button._buttonHoverInit = true

    const text = button.textContent
    button.innerHTML = ''
    ;[...text].forEach((char, index) => {
      const span = document.createElement('span')
      span.textContent = char
      span.style.transitionDelay = `${index * offsetIncrement}s`

      // Handle spaces explicitly
      if (char === ' ') {
        span.style.whiteSpace = 'pre' // Preserve space width
      }

      button.appendChild(span)
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
          tl.reverse().invalidate()
        }

        function open(instant) {
          button.ariaExpanded = 'true'
          instant ? tl.progress(1) : tl.play()
        }

        button.addEventListener('click', () => (button.ariaExpanded === 'true' ? close() : open()))
      }, card)
    })
  })
}

function initPriceCards(next = document) {
  ScrollTrigger.refresh()
  let wrap = next.querySelector('[data-price-status]')

  if (!wrap) {
    return
  }

  if (wrap) {
    const buttons = wrap.querySelectorAll('[data-price-toggle]')
    const row = wrap

    buttons.forEach((button) => {
      const type = button.getAttribute('data-price-toggle')
      button.addEventListener('click', () => {
        if (row.getAttribute('data-price-status') === type) return
        row.setAttribute('data-price-status', type)
        buttons.forEach((btn) => btn.classList.remove('is--active'))
        button.classList.add('is--active')
      })
    })
  } else {
    const left = wrap.querySelector('.p-card.is--left')
    const right = wrap.querySelector('.p-card.is--right')
    const center = wrap.querySelector('.p-card.is--center')
    const anim = wrap.querySelector('[data-lottie]')
    const cards = wrap.querySelectorAll('.p-card')
    const sub = wrap.querySelectorAll('.p-card__sub')

    const animation = lottie.loadAnimation({
      container: anim,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      path: anim.getAttribute('data-lottie-path'),
    })

    gsap
      .timeline({
        scrollTrigger: {
          trigger: wrap,
          start: 'top bottom',
          toggleActions: 'play none none reverse',
        },
        onReverseComplete: () => {
          animation.goToAndStop(0, true)
        },
      })
      .from(left, {
        xPercent: 80,
        yPercent: 30,
        rotate: 6,
        duration: 0.8,
        ease: 'back.out(1.8)',
      })
      .from(
        right,
        {
          xPercent: -80,
          yPercent: 30,
          rotate: -6,
          duration: 0.8,
          ease: 'back.out(1.8)',
        },
        0
      )
      .from(
        center,
        {
          yPercent: 10,
          scale: 0.85,
          duration: 0.8,
          ease: 'back.out(1.5)',
          onStart: () => {
            gsap.delayedCall(0.5, () => {
              animation.play()
            })
          },
        },
        0
      )

    // HOVERING
    cards.forEach((card) => {
      card.addEventListener('mouseenter', () => {
        cards.forEach((c) => c.classList.remove('is--active'))
        card.classList.add('is--active')
        gsap.to(card, {
          scale: prefersReducedMotion() ? 1 : 1.1,
          duration: 0.3,
          ease: 'back.out(1.8)',
          overwrite: 'auto',
        })
      })

      card.addEventListener('mouseleave', () => {
        card.classList.remove('is--active')
        center.classList.add('is--active')
        gsap.to(card, {
          scale: 1,
          duration: 0.3,
          ease: 'back.out(1.5)',
          overwrite: 'auto',
        })
      })
    })

    // PRICE CHANGE
    const solo = next.querySelector('[data-price-solo]')
    const joint = next.querySelector('[data-price-joint]')
    const toggleTl = gsap.timeline({ paused: true })
    toggleTl
      .to('.p-card__heading', {
        y: '-0.9em',
        duration: 0.5,
        ease: 'back.inOut(2)',
      })
      .to(
        '.p-card__eyebrow .eyebrow',
        {
          yPercent: -100,
          duration: 0.5,
          ease: 'back.inOut(2)',
        },
        0
      )
      .to(
        '.p-card__sign.offset',
        {
          left: '0em',
          duration: 0.5,
          ease: 'back.inOut(2)',
        },
        0
      )
      .to(
        sub,
        {
          x: '0em',
          duration: 0.5,
          ease: 'back.inOut(2)',
        },
        0
      )

    solo.addEventListener('click', () => {
      if (!solo.classList.contains('is--active')) {
        joint.classList.remove('is--active')
        solo.classList.add('is--active')
        toggleTl.reverse()
      }
    })

    joint.addEventListener('click', () => {
      if (!joint.classList.contains('is--active')) {
        solo.classList.remove('is--active')
        joint.classList.add('is--active')
        toggleTl.play()
      }
    })
    wrap = null
  }
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

const initRevealText = () => {
  document.querySelectorAll('[data-highlight-text]').forEach((el) => {
    new SplitText(el, {
      type: 'lines, words, chars',
      autoSplit: true,
      onSplit(split) {
        return gsap.context(() => {
          const wordsByLine = split.lines.map((line) =>
            split.words.filter((word) => line.contains(word))
          )

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: el,
              start: 'top 90%',
              toggleActions: 'play none none none',
            },
          })

          const originalColor = getComputedStyle(el).color

          wordsByLine.forEach((words, lineIndex) => {
            const mid = (words.length - 1) / 2

            words.forEach((word, i) => {
              const dist = mid > 0 ? Math.abs(i - mid) / mid : 0
              const staggerDelay = Math.abs(i - mid) * 0.02
              const baseTime = lineIndex * 0.03

              gsap.set(word, { autoAlpha: 0, color: '#E07A5F', y: 50 + dist * 20 })
              tl.to(word, { autoAlpha: 1, duration: 0.2, ease: 'none' }, baseTime + staggerDelay)
              tl.to(
                word,
                { color: originalColor, y: 0, ease: 'power3.out', duration: 1 },
                baseTime + staggerDelay
              )
            })
          })
        })
      },
    })
  })
}

const initRevealText2 = () => {
  document.querySelectorAll('[data-highlight-text]').forEach((el) => {
    new SplitText(el, {
      type: 'lines, words, chars',
      autoSplit: true,
      onSplit(split) {
        return gsap.context(() => {
          const originalColor = getComputedStyle(el).color
          const highlightColor = getComputedStyle(el)
            .getPropertyValue('--_theme---text-color--text-highlight')
            .trim()

          gsap.set(split.chars, { color: highlightColor, opacity: 0.2 })

          const charsByLine = split.lines.map((line) =>
            split.chars.filter((char) => line.contains(char))
          )

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: el,
              start: 'top 100%',
              toggleActions: 'play none none none',
            },
          })

          const textAlign = getComputedStyle(el).textAlign
          const isLeftAligned = textAlign === 'left' || textAlign === 'start'

          const allChars = []
          const offsets = []

          charsByLine.forEach((chars, lineIndex) => {
            const mid = (chars.length - 1) / 2
            chars.forEach((char, i) => {
              const dist = isLeftAligned ? i : Math.abs(i - mid)
              allChars.push(char)
              offsets.push(lineIndex * 0.1 + dist * 0.04)
            })
          })

          tl.to(
            allChars,
            { opacity: 1, duration: 0.2, ease: 'power1.inOut', stagger: (i) => offsets[i] },
            0
          )
          tl.to(
            allChars,
            {
              color: originalColor,
              duration: 0.4,
              ease: 'power3.out',
              stagger: (i) => offsets[i] + 0.2,
            },
            0
          )
        })
      },
    })
  })
}

const initWordReveal = () => {
  const elements = document.querySelectorAll('[data-word-reveal]')
  if (!elements.length) return

  let buffEase = 'expo.out'
  if (typeof CustomEase !== 'undefined') {
    gsap.registerPlugin(CustomEase)
    buffEase = CustomEase.create('buff', 'M0,0 C0,0.837 0.2,0.999 1,1')
  }

  elements.forEach((el) => {
    new SplitText(el, {
      type: 'lines, words',
      autoSplit: true,
      // Break hyphenated compounds ("AI-driven") so the hyphen animates as its
      // own word: "AI", "-", "driven". Pad the hyphen with spaces so GSAP's
      // whitespace word-splitting picks it up; the padding is stripped in
      // onSplit so it renders tight.
      prepareText: (text) => text.replace(/-/g, ' - '),
      onSplit(split) {
        // Drop the padding whitespace around hyphen words so there's no visible
        // gap around the dash ("AI-driven", not "AI - driven").
        split.words.forEach((word) => {
          if (word.textContent.trim() === '-') {
            ;[word.previousSibling, word.nextSibling].forEach((sib) => {
              if (sib && sib.nodeType === 3 && !sib.textContent.trim()) sib.remove()
            })
          }
        })

        return gsap.context(() => {
          gsap.set(split.words, { y: 15, autoAlpha: 0 })

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: el,
              start: 'top 90%',
              toggleActions: 'play none none none',
            },
          })

          // Left-to-right cascade with an uneven gap between words so it feels
          // organic rather than metronomic — some pop quickly, some lag. Gaps
          // average ~0.1, the cadence that felt smooth.
          let t = 0
          const offsets = split.words.map((word, i) => {
            if (i > 0) t += gsap.utils.random(0.05, 0.16)
            return t
          })

          tl.to(split.words, { autoAlpha: 1, duration: 0.001, stagger: (i) => offsets[i] }, 0)
          tl.to(split.words, { y: 0, duration: 0.5, ease: buffEase, stagger: (i) => offsets[i] }, 0)
        })
      },
    })
  })
}

const initHeroParallax = () => {
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '[data-hero]',
      start: 'clamp(top bottom)',
      scrub: true,
    },
  })

  tl.fromTo('[data-hero-bg]', { y: '0vh' }, { y: '30vh' })
}

/* Version with scroll - scrub
function initProgressCards() {
  const wrap = document.querySelector(".progress-container");
  if (!wrap) return;

  const isMobile = window.matchMedia('(max-width: 767px)').matches;

  const progressItems = [...wrap.querySelectorAll(".progress_item")];
  const visualItems = [...wrap.querySelectorAll(".progress-visual_item")];
  const progressBars = [...wrap.querySelectorAll(".progress_line-active")];
  const textList = wrap.querySelector(".progress_list");

  const count = progressItems.length;
  if (!count) return;

  const PHASE_DURATION = 1.5;
  const FADE_DURATION = 0.25;
  const TEXT_SLIDE = 1;
  const GAP = textList ? parseFloat(getComputedStyle(textList).rowGap) || 0 : 0;

  const itemHeights = progressItems.map(el => el.getBoundingClientRect().height);

  visualItems.slice(1).forEach(v => gsap.set(v, { autoAlpha: 0 }));
  if (isMobile) progressItems.slice(1).forEach(el => gsap.set(el, { autoAlpha: 0 }));

  function setActive(index) {
    progressItems.forEach((el, i) => el.classList.toggle("is--active", i === index));
  }

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: ".progress-inner",
      start: "top 50%",
      endTrigger: wrap,
      end: "bottom 80%",
      scrub: true,
      onUpdate(self) {
        setActive(Math.min(Math.floor(self.progress * count), count - 1));
      }
    }
  });

  progressItems.forEach((_, i) => {
    const t = PHASE_DURATION * i;

    if (progressBars[i]) {
      tl.fromTo(progressBars[i],
        { height: "0%" },
        { height: "100%", duration: PHASE_DURATION, ease: "none" },
        t
      );
    }

    if (i > 0) {
      let yOffset = 0;
      for (let j = 0; j < i; j++) yOffset += itemHeights[j] + GAP;

      if (!isMobile && textList) {
        tl.to(textList, {
          y: `${yOffset * -1}px`,
          duration: TEXT_SLIDE,
          ease: "power2.inOut"
        }, t);
      }

      if (isMobile) {
        tl
          .to(progressItems[i - 1], { autoAlpha: 0, y: "-2rem", duration: FADE_DURATION, ease: "power2.out" }, t)
          .fromTo(progressItems[i], { autoAlpha: 0, y: "2rem" }, { autoAlpha: 1, y: "0rem", duration: FADE_DURATION, ease: "power2.out" }, t + FADE_DURATION);
      }

      if (visualItems[i]) {
        tl
          .to(visualItems[i - 1], { autoAlpha: 0, y: '2rem', duration: FADE_DURATION, ease: "power2.in" }, t)
          .fromTo(visualItems[i], { autoAlpha: 0, y:'2rem' }, { autoAlpha: 1, y: '0rem', duration: FADE_DURATION, ease: "power2.out" }, t + FADE_DURATION);
      }
    }
  });

  return tl;
}
*/

/*
function initProgressCards() {
  const wrap = document.querySelector(".progress-container");
  if (!wrap) return;

  const progressItems = [...wrap.querySelectorAll(".progress_item")];
  const visualItems = [...wrap.querySelectorAll(".progress-visual_item")];

  const barHeightInitial = '4px'

  const count = progressItems.length;
  if (!count) return;

  // One easing for every structural switch tween, matching the CSS --progress-ease
  let progressEase = "power2.inOut";
  if (typeof CustomEase !== "undefined") {
    gsap.registerPlugin(CustomEase);
    progressEase = CustomEase.create("progress", "M0,0 C0.6323,-0.0085 0.2618,0.999 1,1");
  }

  const AUTOPLAY_DURATION = 7;        // seconds the progress bar takes to fill
  const SWITCH_DURATION = 0.8;        // expand / collapse (matches --progress-duration)
  const CONTENT_FADE = 1;             // content reveal in
  const CONTENT_OUT = 0.25;           // content fade out
  const REVEAL_STAGGER = 0.03;

  // Per-item element refs
  const tabs = progressItems.map(item => ({
    item,
    line: item.querySelector(".progress_line"),
    bar: item.querySelector(".progress_line-active"),
    expand: item.querySelector(".progress_expand-w"),
    reveal: [...item.querySelectorAll(".progress_expand > *")],
  }));

  // Capture the inactive line position + dimmed item opacity straight from the CSS,
  // so GSAP animates to/from whatever Webflow already set (read before any is--active).
  const rawTop = tabs[0].line ? getComputedStyle(tabs[0].line).top : "0px";
  const inactiveLineTop = rawTop === "auto" ? "0px" : rawTop;
  const inactiveOpacity = getComputedStyle(progressItems[0]).opacity;

  let activeIndex = null;
  let isAnimating = false;
  let barTween = null;

  // Measure each item's full (expanded) height -> the active line-height target.
  // scrollHeight on the collapsed (height:0, overflow:hidden) expand gives the content
  // height without any layout toggle.
  let lineHeights = [];
  function measureLineHeights() {
    lineHeights = tabs.map((tab, i) => {
      if (i === activeIndex) return tab.item.getBoundingClientRect().height; // already open
      const collapsed = tab.item.getBoundingClientRect().height;             // expand at 0
      const content = tab.expand ? tab.expand.scrollHeight : 0;
      return collapsed + content;
    });
  }

  // Collapsed starting state
  tabs.forEach(tab => {
    if (tab.expand) gsap.set(tab.expand, { display: "block", height: 0 });
    if (tab.reveal.length) gsap.set(tab.reveal, { autoAlpha: 0, y: "1rem" });
    if (tab.bar) gsap.set(tab.bar, { height: barHeightInitial });
    if (tab.line) gsap.set(tab.line, { height: barHeightInitial, top: inactiveLineTop });
  });
  visualItems.forEach(v => gsap.set(v.querySelector('.progress-visual_visual-w'), { autoAlpha: 0 }));

  measureLineHeights();

  // Fill the active item's progress bar, then advance to the next tab
  function startProgressBar(index, target) {
    if (barTween) barTween.kill();
    const bar = tabs[index].bar;
    if (!bar) return;
    gsap.set(bar, { height: barHeightInitial });
    barTween = gsap.to(bar, {
      height: target,
      duration: AUTOPLAY_DURATION,
      ease: "none",
      onComplete: () => switchTab((index + 1) % count),
    });
  }

  function switchTab(index) {
    if (isAnimating || index === activeIndex) return;
    isAnimating = true;
    if (barTween) barTween.kill();

    const incoming = tabs[index];
    const outgoing = activeIndex != null ? tabs[activeIndex] : null;
    const incomingVisualItem = visualItems[index];
    const incomingVisual = incomingVisualItem.querySelector('.progress-visual_visual-w')
    const outgoingVisualItem = activeIndex != null ? visualItems[activeIndex] : null;
    const outgoingVisual = outgoingVisualItem?.querySelector('.progress-visual_visual-w')

    progressItems.forEach((el, i) => el.classList.toggle("is--active", i === index));

    const tl = gsap.timeline({
      onComplete: () => {
        activeIndex = index;
        isAnimating = false;
        startProgressBar(index);
      },
    });

    // Expand/collapse, line track and item opacity all run together (same start,
    // duration, ease) so the list reflows in one smooth motion (no jump).
    if (outgoing) {
      if (outgoing.expand) tl.to(outgoing.expand, { height: 0, duration: SWITCH_DURATION, ease: progressEase }, 0);
      if (outgoing.line) tl.to(outgoing.line, { height: barHeightInitial, top: inactiveLineTop, duration: SWITCH_DURATION, ease: progressEase }, 0);
      tl.to(outgoing.item, { opacity: inactiveOpacity, duration: SWITCH_DURATION, ease: progressEase }, 0);
    }
    if (incoming.expand) {
      tl.fromTo(incoming.expand,
        { height: 0 },
        { height: "auto", duration: SWITCH_DURATION, ease: progressEase }, 0);
    }
    if (incoming.line) {
      tl.to(incoming.line, { height: lineHeights[index], top: 0, duration: SWITCH_DURATION, ease: progressEase }, 0);
    }
    tl.to(incoming.item, { opacity: 1, duration: SWITCH_DURATION, ease: progressEase }, 0);

    // Outgoing content / bar / visual fade out immediately
    if (outgoing) {
      if (outgoing.reveal.length) tl.to(outgoing.reveal, { autoAlpha: 0, y: "-1rem", duration: CONTENT_OUT, ease: "power2.in" }, 0);
      if (outgoing.bar) tl.to(outgoing.bar, { height: barHeightInitial, duration: 0.3, ease: "power4.out" }, 0);
      if (outgoingVisual) tl.to(outgoingVisual, { autoAlpha: 0, y: "2rem", duration: 0.5, ease: "power2.in" }, 0);
    }

    // Incoming content reveals
    if (incoming.reveal.length) {
      tl.fromTo(incoming.reveal,
        { autoAlpha: 0, y: "4rem" },
        { autoAlpha: 1, y: "0rem", duration: CONTENT_FADE, ease: "power4.out", stagger: REVEAL_STAGGER },
        0.2
      );
    }
    // Incoming visual reveals
    if (incomingVisual) {
      tl.fromTo(incomingVisual,
        { autoAlpha: 0, y: "4rem" },
        { autoAlpha: 1, y: "0rem", duration: 0.8, ease: "power4.out" },
        SWITCH_DURATION
      );
    }
  }

  // Start the autoplay loop once the section scrolls into view
  ScrollTrigger.create({
    trigger: ".progress-inner",
    start: "top 50%",
    once: true,
    onEnter: () => switchTab(0),
  });

  // Re-measure on resize and snap the active line to the new height
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      measureLineHeights();
      if (activeIndex != null && tabs[activeIndex].line) {
        gsap.set(tabs[activeIndex].line, { height: lineHeights[activeIndex], top: 0 });
      }
    }, 150);
  });

  // Click a card to jump to it (but let the inner CTA link through)
  progressItems.forEach((item, i) => {
    item.addEventListener("click", (e) => {
      if (e.target.closest(".button-w")) return;
      switchTab(i);
    });
  });
}
*/

function initProgressCards() {
  const wrap = document.querySelector('[data-init-progress]')
  if (!wrap) return

  const progressItems = [...wrap.querySelectorAll('.progress_item')]
  const visualItems = [...wrap.querySelectorAll('.progress-visual_item')]

  const barHeightInitial = '4px'

  const count = progressItems.length
  if (!count) return

  const AUTOPLAY_DURATION = 7 // seconds the progress bar takes to fill
  const SWITCH_DURATION = 0.6 // expand / collapse (kept in lockstep)
  const EXPAND_EASE = 'power2.inOut' // shared by collapse + expand so heights track
  const CONTENT_FADE = 1 // content reveal in
  const CONTENT_OUT = 0.25 // content fade out
  const REVEAL_STAGGER = 0.03

  // Per-item element refs
  const tabs = progressItems.map((item) => ({
    item,
    line: item.querySelector('.progress_line'),
    bar: item.querySelector('.progress_line-active'),
    cap: item.querySelector('.progress_line-cap'),
    expand: item.querySelector('.progress_expand-w'),
    reveal: [...item.querySelectorAll('.progress_expand > *')],
  }))

  // Collapsed starting state
  tabs.forEach((tab) => {
    if (tab.expand) gsap.set(tab.expand, { display: 'block', height: 0 })
    if (tab.reveal.length) gsap.set(tab.reveal, { autoAlpha: 0, y: '1rem' })
    if (tab.bar) gsap.set(tab.bar, { height: barHeightInitial })
    if (tab.line) gsap.set(tab.line, { height: barHeightInitial })
    if (tab.cap) gsap.set(tab.cap, { top: 0, y: parseFloat(barHeightInitial) })
  })
  visualItems.forEach((v) =>
    gsap.set(v.querySelector('.progress-visual_visual-w'), { autoAlpha: 0 })
  )

  let activeIndex = null
  let currentTl = null // in-progress switch timeline (so we can interrupt it)
  let barTween = null
  const BAR_START_DELAY = 0.15 // small pause before the timer bar starts filling

  // Fill the active item's progress bar, then advance to the next tab
  function startProgressBar(index, target) {
    if (barTween) barTween.kill()
    const { bar, cap } = tabs[index]
    if (!bar) return
    gsap.set(bar, { height: barHeightInitial })
    if (cap) gsap.set(cap, { y: parseFloat(barHeightInitial) })
    barTween = gsap.timeline({
      delay: BAR_START_DELAY,
      onComplete: () => switchTab((index + 1) % count),
    })
    barTween.to(bar, { height: target, duration: AUTOPLAY_DURATION, ease: 'none' }, 0)
    if (cap) barTween.to(cap, { y: target, duration: AUTOPLAY_DURATION, ease: 'none' }, 0)
  }

  function switchTab(index) {
    if (index === activeIndex) return
    activeIndex = index // claim immediately so re-clicks compare correctly
    if (currentTl) currentTl.kill() // interrupt any switch already in progress

    const incoming = tabs[index]
    const incomingVisual = visualItems[index].querySelector('.progress-visual_visual-w')

    progressItems.forEach((el, i) => el.classList.toggle('is--active', i === index))

    // Item's final (expanded) height — drives both the line-track target and the
    // progress-bar fill (the track is still growing when the bar starts, so we
    // can't use "100%").
    const lineTarget = incoming.expand
      ? incoming.item.getBoundingClientRect().height + incoming.expand.scrollHeight
      : incoming.item.getBoundingClientRect().height

    // Start the timer the moment we switch, in parallel with the transition
    startProgressBar(index, lineTarget)

    const tl = gsap.timeline({
      onComplete: () => {
        if (currentTl === tl) currentTl = null
      },
    })
    currentTl = tl

    // Collapse every other tab from its CURRENT state — `to` (not `fromTo`) means an
    // interrupted, half-open item animates from where it is, never popping or stranding.
    tabs.forEach((tab, i) => {
      if (i === index) return
      if (tab.expand)
        tl.to(tab.expand, { height: 0, duration: SWITCH_DURATION, ease: EXPAND_EASE }, 0)
      if (tab.line)
        tl.to(
          tab.line,
          { height: barHeightInitial, duration: SWITCH_DURATION, ease: EXPAND_EASE },
          0
        )
      if (tab.bar)
        tl.to(tab.bar, { height: barHeightInitial, duration: 0.3, ease: 'power4.out' }, 0)
      if (tab.cap)
        tl.to(tab.cap, { y: parseFloat(barHeightInitial), duration: 0.3, ease: 'power4.out' }, 0)
      if (tab.reveal.length)
        tl.to(tab.reveal, { autoAlpha: 0, y: '-1rem', duration: CONTENT_OUT, ease: 'power2.in' }, 0)
      const vis = visualItems[i].querySelector('.progress-visual_visual-w')
      if (vis) tl.to(vis, { autoAlpha: 0, y: '2rem', duration: 0.5, ease: 'power2.in' }, 0)
    })

    // Expand incoming from its current state (`to`, not `fromTo`, so height never pops)
    if (incoming.expand)
      tl.to(incoming.expand, { height: 'auto', duration: SWITCH_DURATION, ease: EXPAND_EASE }, 0)
    if (incoming.line)
      tl.to(incoming.line, { height: lineTarget, duration: SWITCH_DURATION, ease: EXPAND_EASE }, 0)

    // Incoming content + visual reveal
    if (incoming.reveal.length) {
      tl.fromTo(
        incoming.reveal,
        { autoAlpha: 0, y: '4rem' },
        {
          autoAlpha: 1,
          y: '0rem',
          duration: CONTENT_FADE,
          ease: 'power4.out',
          stagger: REVEAL_STAGGER,
        },
        0.2
      )
    }
    if (incomingVisual) {
      tl.fromTo(
        incomingVisual,
        { autoAlpha: 0, y: '4rem' },
        { autoAlpha: 1, y: '0rem', duration: 0.8, ease: 'power4.out' },
        SWITCH_DURATION
      )
    }
  }

  // Start the autoplay loop once the section scrolls into view
  ScrollTrigger.create({
    trigger: '[data-init-progress]',
    start: 'top 50%',
    once: true,
    onEnter: () => switchTab(0),
  })

  // Click a card to jump to it (but let the inner CTA link through)
  progressItems.forEach((item, i) => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.button-w')) return
      switchTab(i)
    })
  })
}

function initTypewriter() {
  const SPEEDS = {
    slow: 0.14,
    normal: 0.06,
    fast: 0.018,
  }

  function animate(target, scrollTrigger) {
    const speedKey = target.getAttribute('data-typewriter-speed') || 'normal'
    const stagger = SPEEDS[speedKey] ?? SPEEDS.normal

    const split = new SplitText(target, { type: 'chars', charsClass: 'tw-char' })
    gsap.set(split.chars, { autoAlpha: 0 })

    const opts = {
      autoAlpha: 1,
      duration: 0.01,
      stagger,
      ease: 'none',
      onComplete: () => split.revert(),
    }
    if (scrollTrigger) opts.scrollTrigger = scrollTrigger

    gsap.to(split.chars, opts)
  }

  document.querySelectorAll('[data-typewriter="load"]').forEach((el) => animate(el, null))

  document
    .querySelectorAll('[data-typewriter="scroll"]')
    .forEach((el) => animate(el, { trigger: el, start: 'top bottom', once: true }))
}

const initFooterGradient = () => {
  const CONFIG = {
    logo: '.footer_logo',
    hoverArea: '.footer_component',
    duration: 0.5,
    ease: 'power3',
    fade: 0.35,
    shimmerStops: ['#DF9A65', '#DBA878', '#EBBE93'],
  }

  const SVG_NS = 'http://www.w3.org/2000/svg'
  let uid = 0

  function initShimmer(logo) {
    const svg = logo.querySelector('svg')
    if (!svg) return

    const area = logo.closest(CONFIG.hoverArea) || document.querySelector(CONFIG.hoverArea) || logo

    const shimmer = svg.cloneNode(true)
    shimmer.removeAttribute('aria-label')
    shimmer.setAttribute('aria-hidden', 'true')
    shimmer.classList.add('hz-shimmer')
    shimmer.querySelectorAll('defs').forEach((d) => d.remove())

    const gid = 'hzShimmerGrad' + uid++
    const vb = (shimmer.getAttribute('viewBox') || '0 0 100 100').split(/\s+/).map(Number)
    const defs = document.createElementNS(SVG_NS, 'defs')
    const grad = document.createElementNS(SVG_NS, 'linearGradient')
    grad.setAttribute('id', gid)
    grad.setAttribute('gradientUnits', 'userSpaceOnUse')
    grad.setAttribute('x1', vb[0])
    grad.setAttribute('y1', vb[1])
    grad.setAttribute('x2', vb[0] + vb[2])
    grad.setAttribute('y2', vb[1] + vb[3])
    CONFIG.shimmerStops.forEach((color, i, arr) => {
      const stop = document.createElementNS(SVG_NS, 'stop')
      stop.setAttribute('offset', arr.length > 1 ? i / (arr.length - 1) : 0)
      stop.setAttribute('stop-color', color)
      grad.appendChild(stop)
    })
    defs.appendChild(grad)
    shimmer.insertBefore(defs, shimmer.firstChild)
    shimmer.querySelectorAll('path').forEach((p) => p.setAttribute('fill', 'url(#' + gid + ')'))
    logo.appendChild(shimmer)

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dur = reduce ? 0 : CONFIG.duration

    const xTo = gsap.quickTo(logo, '--xp', { duration: dur, ease: CONFIG.ease })
    const yTo = gsap.quickTo(logo, '--yp', { duration: dur, ease: CONFIG.ease })

    const toPct = (e) => {
      const r = logo.getBoundingClientRect()
      return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100]
    }

    area.addEventListener('pointerenter', (e) => {
      const [x, y] = toPct(e)
      gsap.set(logo, { '--xp': x, '--yp': y })
      gsap.to(shimmer, { opacity: 1, duration: CONFIG.fade, overwrite: true })
    })
    area.addEventListener('pointermove', (e) => {
      const [x, y] = toPct(e)
      xTo(x)
      yTo(y)
    })
    area.addEventListener('pointerleave', () => {
      gsap.to(shimmer, { opacity: 0, duration: CONFIG.fade, overwrite: true })
    })
  }

  function boot() {
    document.querySelectorAll(CONFIG.logo).forEach(initShimmer)
  }
  boot()
}

const initAnimateCards = () => {
  if (!document.querySelector('[data-animate-cards]')) return

  const cards = document.querySelectorAll('[data-animate-cards]')

  const mm = gsap.matchMedia()
  mm.add(MQ.tabletUp, () => {
    cards.forEach((el) => {
      const ui = el.querySelectorAll('[data-card-ui]')
      gsap.set(ui, { y: '6rem' })
      gsap
        .timeline({
          defaults: { ease: 'power4.out' },
          scrollTrigger: {
            trigger: el,
            start: 'clamp(top 90%)',
            invalidateOnRefresh: true,
          },
        })
        // from: 'center' makes a 2-card row equidistant (no stagger), so fall back to 'start'
        .to(ui, {
          y: '0rem',
          duration: 1.1,
          stagger: { each: 0.1, from: ui.length > 2 ? 'center' : 'start' },
        })
    })
  })
}

function initCursor(container) {
  function initFollower() {
    container = document.querySelector('body')
    const follower = document.querySelector('.cursor-item')
    if (!follower || !container) return
    let targetX = 0,
      targetY = 0
    let currentX = 0,
      currentY = 0
    let velocityX = 0,
      velocityY = 0
    let lastY = 0
    let rotation = 0
    let targetOpacity = 0,
      currentOpacity = 0

    function lerp(start, end, factor) {
      return (1 - factor) * start + factor * end
    }

    const stiffness = 0.1
    const damping = 0.55
    const rotationSensitivity = 0.1

    function animate() {
      const dx = targetX - currentX
      const dy = targetY - currentY

      // Calculate velocity
      velocityX += dx * stiffness
      velocityY += dy * stiffness

      // Apply damping
      velocityX *= damping
      velocityY *= damping

      // Update current position
      currentX += velocityX
      currentY += velocityY

      const speedY = targetY - lastY

      if (Math.abs(speedY) > 0.2) {
        rotation = Math.max(Math.min(rotation + speedY * (rotationSensitivity * -1), 90), -90)
      } else {
        rotation = lerp(rotation, 0, 0.2)
      }

      follower.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotation}deg)`

      currentOpacity = lerp(currentOpacity, targetOpacity, 0.15)
      follower.style.opacity = currentOpacity

      lastY = targetY

      requestAnimationFrame(animate)
    }
    animate()

    document.addEventListener('mousemove', (e) => {
      targetX = e.clientX
      targetY = e.clientY
    })

    document.querySelectorAll('[data-cursor]').forEach((element) => {
      element.addEventListener('mouseenter', function () {
        const cursorWrapper = document.querySelector('.cursor-item')
        if (cursorWrapper) {
          cursorWrapper.style.display = 'flex'
        }
        targetOpacity = 1
        const cursorText = this.getAttribute('data-cursor')
        if (cursorText) {
          const cursorTextElement = document.querySelector('[data-cursor-text]')
          if (cursorTextElement) {
            cursorTextElement.textContent = cursorText
          }
        }
      })

      element.addEventListener('mouseleave', function () {
        targetOpacity = 0
      })
    })
  }
  initFollower()
}

function initSliderDragInset() {
  document.querySelectorAll('.slider_wrap').forEach((wrap) => {
    const items = wrap.querySelectorAll('.slider_item-w')
    if (!items.length) return

    gsap.set(items, { clipPath: 'inset(0rem round 1rem)' }) // numeric baseline so inset() interpolates

    const press = () =>
      gsap.to(items, { clipPath: 'inset(.25rem round 1rem)', duration: 0.4, ease: 'power3.out' })
    const release = () =>
      gsap.to(items, { clipPath: 'inset(0rem round 1rem)', duration: 0.4, ease: 'power3.out' })

    wrap.addEventListener('pointerdown', press)
    // release on window: the drag often ends with the pointer off the slider
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
  })
}

export function initGlobal() {
  initTextAnimations()
  // initHighlightText()
  // initRevealText()
  initRevealText2()
  initWordReveal()
  initMarqueeScrollDirection()

  initNumbersAnimation()
  initButton()

  initLineRevealTestimonials()

  initFaqs()

  initPriceCards()
  initHeroParallax()
  initProgressCards()
  initTypewriter()

  initFooterGradient()

  initAnimateCards()
  initCursor()
  initSliderDragInset()
}
