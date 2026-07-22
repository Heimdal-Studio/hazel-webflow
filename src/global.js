import { MQ } from './utils/breakpoints.js'
import { splitReveal } from './utils/splitReveal.js'
import { requestScrollRefresh } from './utils/scroll-refresh.js'

function initTextAnimations() {
  const reveal = (el) => {
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
  }

  document.querySelectorAll('[data-split]').forEach((el) => {
    // Defer the split (a forced reflow) until the element nears the viewport, so
    // off-screen text never measures at load. By scroll time fonts have swapped
    // in too, so it splits once instead of split + font re-split. Elements in
    // view at load fire onEnter immediately on refresh — same timing as before.
    ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      once: true,
      onEnter: () => reveal(el),
    })
  })
}

const initNumbersAnimation2 = () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const initFlag = 'data-odometer-initialized'

  const defaults = {
    duration: 1.5, // count-up (s)
    startFraction: 0.8, // start at 80% of target
    steps: 12, // stop-motion ticks (fewer = choppier)
    elementStagger: 0.1, // stagger between numbers
    triggerStart: 'top bottom',
    staggerOrder: 'left',
  }

  document.querySelectorAll('[data-odometer-group]').forEach((group) => {
    if (group.hasAttribute(initFlag)) return
    group.setAttribute(initFlag, '')

    const elements = Array.from(group.querySelectorAll('[data-odometer-element]'))
    if (!elements.length || prefersReducedMotion) return

    const staggerOrder = group.getAttribute('data-odometer-stagger-order') || defaults.staggerOrder
    const triggerStart = group.getAttribute('data-odometer-trigger-start') || defaults.triggerStart
    const elementStagger =
      parseFloat(group.getAttribute('data-odometer-stagger')) || defaults.elementStagger
    const steps = parseFloat(group.getAttribute('data-odometer-steps')) || defaults.steps
    const startFraction =
      parseFloat(group.getAttribute('data-odometer-start-fraction')) || defaults.startFraction

    // count up start→target; prefix/suffix re-applied each frame
    const counters = elements
      .map((el) => {
        const originalText = el.textContent.trim()
        const num = parseNumber(originalText)
        if (!num) return null
        const startAttr = el.getAttribute('data-odometer-start')
        const startValue = startAttr !== null ? parseFloat(startAttr) : num.value * startFraction
        const duration = parseFloat(el.getAttribute('data-odometer-duration')) || defaults.duration
        return { el, originalText, startValue, duration, ...num }
      })
      .filter(Boolean)

    const tl = gsap.timeline({
      scrollTrigger: { trigger: group, start: triggerStart, once: true },
    })

    const stepEase = `steps(${Math.max(1, Math.round(steps))})`

    applyStaggerOrder(counters, staggerOrder).forEach((c, orderIdx) => {
      const proxy = { val: c.startValue }
      const render = (v) => {
        c.el.textContent = c.prefix + format(v, c.decimals, c.grouping) + c.suffix
      }
      render(c.startValue) // show start, no flash of target
      tl.to(
        proxy,
        {
          val: c.value,
          duration: c.duration,
          // stop-motion: discrete ticks
          ease: stepEase,
          onUpdate() {
            render(proxy.val)
          },
          onComplete() {
            c.el.textContent = c.originalText // land on authored text
          },
        },
        orderIdx * elementStagger
      )
    })
  })

  // split prefix / number / suffix
  function parseNumber(text) {
    const match = text.match(/[\d,]*\d(?:\.\d+)?/)
    if (!match) return null
    const numStr = match[0]
    return {
      prefix: text.slice(0, match.index),
      suffix: text.slice(match.index + numStr.length),
      value: parseFloat(numStr.replace(/,/g, '')),
      decimals: numStr.includes('.') ? numStr.split('.')[1].length : 0,
      grouping: numStr.includes(','),
    }
  }

  function format(val, decimals, grouping) {
    return val.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: grouping,
    })
  }

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
    const marqueeContent = marquee.querySelector('[data-marquee-collection-target]')
    const marqueeScroll = marquee.querySelector('[data-marquee-scroll-target]')
    if (!marqueeContent || !marqueeScroll) return

    const {
      marqueeSpeed: speed,
      marqueeDirection: direction,
      marqueeDuplicate: duplicate,
      marqueeScrollSpeed: scrollSpeed,
    } = marquee.dataset

    const marqueeSpeedAttr = parseFloat(speed) || 30
    const marqueeDirectionAttr = direction === 'right' ? 1 : -1
    const duplicateAmount = parseInt(duplicate || 0)
    const scrollSpeedAttr = parseFloat(scrollSpeed) || 1
    const speedMultiplier = window.innerWidth < 479 ? 0.25 : window.innerWidth < 991 ? 0.5 : 1

    const marqueeSpeed =
      marqueeSpeedAttr * (marqueeContent.offsetWidth / window.innerWidth) * speedMultiplier

    marqueeScroll.style.marginLeft = `${scrollSpeedAttr * -1}%`
    marqueeScroll.style.width = `${scrollSpeedAttr * 2 + 100}%`

    if (duplicateAmount > 0) {
      const fragment = document.createDocumentFragment()
      for (let i = 0; i < duplicateAmount; i++) {
        fragment.appendChild(marqueeContent.cloneNode(true))
      }
      marqueeScroll.appendChild(fragment)
    }

    const marqueeItems = marquee.querySelectorAll('[data-marquee-collection-target]')
    const animation = gsap
      .to(marqueeItems, {
        xPercent: -100,
        repeat: -1,
        duration: marqueeSpeed,
        ease: 'linear',
      })
      .totalProgress(0.5)

    gsap.set(marqueeItems, { xPercent: marqueeDirectionAttr === 1 ? 100 : -100 })
    animation.timeScale(marqueeDirectionAttr)
    animation.play()

    marquee.setAttribute('data-marquee-status', 'normal')

    let lastDirection = 0
    const visibility = ScrollTrigger.create({
      trigger: marquee,
      start: 'top bottom',
      end: 'bottom top',
      // repeat:-1 tween otherwise runs forever; only tick it while on screen
      onToggle: (self) => (self.isActive ? animation.play() : animation.pause()),
      onUpdate: (self) => {
        // fires every scroll frame; only touch the DOM on direction change
        if (self.direction === lastDirection) return
        lastDirection = self.direction

        const isInverted = self.direction === 1
        const currentDirection = isInverted ? -marqueeDirectionAttr : marqueeDirectionAttr

        animation.timeScale(currentDirection)
        marquee.setAttribute('data-marquee-status', isInverted ? 'normal' : 'inverted')
      },
    })
    if (!visibility.isActive) animation.pause()

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

      if (char === ' ') {
        span.style.whiteSpace = 'pre'
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

      // live Designer markup has no [data-testimonial-text] attr on the quote — class-match like .testimonial-lines__name
      splitTargets: [
        ...item.querySelectorAll(
          '[data-testimonial-text], [data-testimonial-split], .testimonial-lines__h, .testimonial-lines__name'
        ),
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

    slides.forEach((_, i) => setSlideState(i, i === activeIndex))
    updateCounter()

    gsap.matchMedia().add({ reduce: '(prefers-reduced-motion: reduce)' }, (context) => {
      reduceMotion = context.conditions.reduce
    })

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

      // skip while typing
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

    window.addEventListener('keydown', onKeyDown)

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
          // gated: a raw refresh here is a sync reflow that can stall mid-scroll
          onComplete: requestScrollRefresh,
          onReverseComplete: requestScrollRefresh,
        })
        tl.set(content, { display: 'block' })
        tl.fromTo(content, { height: 0 }, { height: 'auto' })
        tl.fromTo('.accordion_icon', { rotate: 0 }, { rotate: -180 }, '<')

        function close() {
          if (button.ariaExpanded === 'false') return
          button.ariaExpanded = 'false'
          tl.timeScale(1.7).reverse().invalidate()
        }

        function open(instant) {
          button.ariaExpanded = 'true'
          tl.timeScale(1)
          instant ? tl.progress(1) : tl.play()
        }

        button.addEventListener('click', () => (button.ariaExpanded === 'true' ? close() : open()))
      }, card)
    })
  })
}

function initPriceCards(next = document) {
  const wrap = next.querySelector('[data-price-status]')
  if (!wrap) return

  const buttons = wrap.querySelectorAll('[data-price-toggle]')
  buttons.forEach((button) => {
    const type = button.getAttribute('data-price-toggle')
    button.addEventListener('click', () => {
      if (wrap.getAttribute('data-price-status') === type) return
      wrap.setAttribute('data-price-status', type)
      buttons.forEach((btn) => btn.classList.remove('is--active'))
      button.classList.add('is--active')
    })
  })
}

// per-char stagger offsets
function computeCharOffsets(split, isLeftAligned) {
  const allChars = []
  const offsets = []
  split.lines
    .map((line) => split.chars.filter((char) => line.contains(char)))
    .forEach((chars, lineIndex) => {
      const mid = (chars.length - 1) / 2
      chars.forEach((char, i) => {
        const dist = isLeftAligned ? i : Math.abs(i - mid)
        allChars.push(char)
        offsets.push(lineIndex * 0.1 + dist * 0.04)
      })
    })
  return { allChars, offsets }
}

// char-fill highlight (titles + hero)
function highlightFill(el, split, tl, position = 0, fromOpacity = 0.2) {
  const cs = getComputedStyle(el)
  const originalColor = cs.color
  const highlightColor =
    cs.getPropertyValue('--_theme---text-color--text-highlight').trim() || originalColor
  const isLeftAligned = cs.textAlign === 'left' || cs.textAlign === 'start'
  const { allChars, offsets } = computeCharOffsets(split, isLeftAligned)

  gsap.set(allChars, { color: highlightColor, opacity: fromOpacity })
  tl.to(
    allChars,
    { opacity: 1, duration: 0.2, ease: 'power1.inOut', stagger: (i) => offsets[i] },
    position
  )
  tl.to(
    allChars,
    { color: originalColor, duration: 0.4, ease: 'power3.out', stagger: (i) => offsets[i] + 0.2 },
    position
  )
}

const initTitleAnimation = () => {
  document.querySelectorAll('[data-highlight-text]').forEach((el) => {
    // intro timeline owns the hero title
    if (el.closest('[data-hero-intro]')) return

    new SplitText(el, {
      type: 'lines, words, chars',
      autoSplit: true,
      onSplit(split) {
        return gsap.context(() => {
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: el,
              start: 'top 100%',
              toggleActions: 'play none none none',
            },
          })
          highlightFill(el, split, tl)
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

function initTabs() {
  document.querySelectorAll('[data-init-progress]').forEach(initTabsSection)
}

function initTabsSection(wrap) {
  const VISUAL_SELECTOR = '.visual_img' // edit if Webflow renames it
  const DIRECTION_ATTR = 'data-wf--tabs---animate-from--direction'
  const DIRECTIONS = {
    top: [0, -1],
    right: [1, 0],
    bottom: [0, 1],
    left: [-1, 0],
    'top-left': [-1, -1],
    'top-right': [1, -1],
    'bottom-left': [-1, 1],
    'bottom-right': [1, 1],
  }

  const progressItems = [...wrap.querySelectorAll('.progress_item')]
  const visualItems = [...wrap.querySelectorAll('.progress-visual_item')]

  const barHeightInitial = '4px'

  const count = progressItems.length
  if (!count) return

  const AUTOPLAY_DURATION = 7 // bar fill (s)
  const SWITCH_DURATION = 0.6 // expand/collapse
  const EXPAND_EASE = 'power2.inOut' // collapse + expand
  const CONTENT_FADE = 1 // reveal in
  const CONTENT_OUT = 0.25 // fade out
  const REVEAL_STAGGER = 0.03

  const tabs = progressItems.map((item, i) => {
    const visualItem = visualItems[i]
    const direction = visualItem?.querySelector(`[${DIRECTION_ATTR}]`)?.getAttribute(DIRECTION_ATTR)
    const [dx, dy] = DIRECTIONS[direction] || DIRECTIONS.bottom
    return {
      item,
      line: item.querySelector('.progress_line'),
      bar: item.querySelector('.progress_line-active'),
      cap: item.querySelector('.progress_line-cap'),
      expand: item.querySelector('.progress_expand-w'),
      reveal: [...item.querySelectorAll('.progress_expand > *')],
      visual: visualItem ? visualItem.querySelector(VISUAL_SELECTOR) : null,
      dx,
      dy,
    }
  })

  tabs.forEach((tab, i) => {
    if (tab.expand) gsap.set(tab.expand, { display: 'block', height: 0 })
    if (tab.reveal.length) gsap.set(tab.reveal, { autoAlpha: 0, y: '1rem' })
    if (tab.bar) gsap.set(tab.bar, { height: barHeightInitial, transformOrigin: 'top left' })
    if (tab.line) gsap.set(tab.line, { height: barHeightInitial })
    if (tab.cap) gsap.set(tab.cap, { top: 0, y: parseFloat(barHeightInitial) })
    // first is visible from load
    if (tab.visual) {
      gsap.set(tab.visual, { autoAlpha: i === 0 ? 1 : 0 })
      tab.visual.decode?.().catch(() => {})
    }
  })

  // Safari: without containment WebKit re-lays-out the visual imgs on every
  // frame of the expand height tween even though they never move — measured
  // 28ms → 16.7ms frames. Containment lets it skip the whole subtree.
  visualItems.forEach((v) => (v.style.contain = 'layout paint'))

  let activeIndex = null
  let currentTl = null
  let barTween = null
  const BAR_START_DELAY = 0.15

  function startProgressBar(index, target) {
    if (barTween) barTween.kill()
    const tab = tabs[index]
    const { bar, cap } = tab
    if (!bar) return
    // fill via scaleY, not height — a 7s height tween relayouts every frame,
    // which is the main Safari jank source in this section
    tab.barScaleMin = parseFloat(barHeightInitial) / target
    gsap.set(bar, { height: target, scaleY: tab.barScaleMin })
    if (cap) gsap.set(cap, { y: parseFloat(barHeightInitial) })
    barTween = gsap.timeline({
      delay: BAR_START_DELAY,
      onComplete: () => switchTab((index + 1) % count),
    })
    barTween.to(bar, { scaleY: 1, duration: AUTOPLAY_DURATION, ease: 'none', force3D: true }, 0)
    if (cap) barTween.to(cap, { y: target, duration: AUTOPLAY_DURATION, ease: 'none' }, 0)
  }

  function switchTab(index) {
    if (index === activeIndex) return
    const isFirst = activeIndex === null
    activeIndex = index // claim before await
    if (currentTl) currentTl.kill()

    const incoming = tabs[index]
    const incomingVisual = incoming.visual

    // reads before the class toggle dirties layout (avoids a forced reflow)
    const lineTarget = incoming.expand
      ? incoming.item.getBoundingClientRect().height + incoming.expand.scrollHeight
      : incoming.item.getBoundingClientRect().height

    progressItems.forEach((el, i) => el.classList.toggle('is--active', i === index))

    startProgressBar(index, lineTarget)

    // only tabs that are actually open get collapse tweens; `open` clears on
    // the timeline's onComplete, so a killed mid-collapse tab re-collapses on
    // the next switch instead of freezing half-open
    const closing = tabs.filter((tab, i) => i !== index && tab.open)
    incoming.open = true

    const tl = gsap.timeline({
      onComplete: () => {
        closing.forEach((tab) => (tab.open = false))
        if (currentTl === tl) currentTl = null
      },
    })
    currentTl = tl

    // `to` so interrupts collapse in place
    closing.forEach((tab) => {
      if (tab.expand)
        tl.to(tab.expand, { height: 0, duration: SWITCH_DURATION, ease: EXPAND_EASE }, 0)
      if (tab.line)
        tl.to(
          tab.line,
          { height: barHeightInitial, duration: SWITCH_DURATION, ease: EXPAND_EASE },
          0
        )
      if (tab.bar)
        tl.to(tab.bar, { scaleY: tab.barScaleMin || 1, duration: 0.3, ease: 'power4.out' }, 0)
      if (tab.cap)
        tl.to(tab.cap, { y: parseFloat(barHeightInitial), duration: 0.3, ease: 'power4.out' }, 0)
      if (tab.reveal.length)
        tl.to(tab.reveal, { autoAlpha: 0, y: '-1rem', duration: CONTENT_OUT, ease: 'power2.in' }, 0)
      if (tab.visual)
        tl.to(
          tab.visual,
          // exits back toward where it entered from
          {
            autoAlpha: 0,
            x: tab.dx * 2 + 'rem',
            y: tab.dy * 2 + 'rem',
            duration: 0.5,
            ease: 'power2.in',
          },
          0
        )
    })

    if (incoming.expand)
      tl.to(incoming.expand, { height: 'auto', duration: SWITCH_DURATION, ease: EXPAND_EASE }, 0)
    if (incoming.line)
      tl.to(incoming.line, { height: lineTarget, duration: SWITCH_DURATION, ease: EXPAND_EASE }, 0)

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
      // tab 0 already visible
      if (!(isFirst && index === 0)) {
        tl.fromTo(
          incomingVisual,
          { autoAlpha: 0, x: incoming.dx * 4 + 'rem', y: incoming.dy * 4 + 'rem' },
          { autoAlpha: 1, x: '0rem', y: '0rem', duration: 0.8, ease: 'power4.out' },
          SWITCH_DURATION
        )
      }
    }
  }

  // autoplay only while in view
  let started = false
  ScrollTrigger.create({
    trigger: wrap,
    start: 'top 50%',
    end: 'bottom top',
    onToggle: (self) => {
      if (self.isActive) {
        if (!started) {
          started = true
          switchTab(0)
        } else {
          if (barTween) barTween.resume()
          if (currentTl) currentTl.resume()
        }
      } else if (started) {
        if (barTween) barTween.pause()
        if (currentTl) currentTl.pause()
      }
    },
  })

  // click to jump; let CTA through
  progressItems.forEach((item, i) => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.button-w')) return
      switchTab(i)
    })
  })
}

const TW_SPEEDS = { slow: 0.14, normal: 0.06, fast: 0.018 }

// hidden chars + reveal vars
function typewriterPrep(target) {
  const speedKey = target.getAttribute('data-typewriter-speed') || 'normal'
  const stagger = TW_SPEEDS[speedKey] ?? TW_SPEEDS.normal
  // aria:'hidden' — SplitText's default aria-label is prohibited on the generic
  // eyebrow <div>; these are decorative kickers, so hide from AT instead.
  const split = new SplitText(target, { type: 'chars', charsClass: 'tw-char', aria: 'hidden' })
  gsap.set(split.chars, { autoAlpha: 0 })
  return {
    split,
    chars: split.chars,
    vars: { autoAlpha: 1, duration: 0.01, stagger, ease: 'none' },
  }
}

function initTypewriter() {
  function animate(target, scrollTrigger) {
    const { split, chars, vars } = typewriterPrep(target)
    const opts = { ...vars, onComplete: () => split.revert() }
    if (scrollTrigger) opts.scrollTrigger = scrollTrigger
    gsap.to(chars, opts)
  }

  // intro timeline owns the hero eyebrow
  document
    .querySelectorAll('[data-typewriter="load"]')
    .forEach((el) => el.closest('[data-hero-intro]') || animate(el, null))

  document
    .querySelectorAll('[data-typewriter="scroll"]')
    .forEach(
      (el) =>
        el.closest('[data-hero-intro]') ||
        animate(el, { trigger: el, start: 'top bottom', once: true })
    )
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

  // Webflow nests data-animate-cards on both the list wrapper and its inner
  // display-contents div; only process the outer one or every card gets a
  // duplicate timeline that stomps the first and kills the stagger.
  const cards = [...document.querySelectorAll('[data-animate-cards]')].filter(
    (el) => !el.parentElement?.closest('[data-animate-cards]')
  )

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
            start: 'clamp(top 100%)',
            invalidateOnRefresh: true,
          },
        })
        // center stagger breaks 2-card rows
        .to(ui, {
          y: '0rem',
          duration: 1.1,
          stagger: { each: 0.1, from: ui.length > 2 ? 'center' : 'start' },
        })
    })
  })
}

// cursor follower + slider press inset (tablet+)
function initCursor() {
  gsap.matchMedia().add(MQ.tabletUp, () => {
    const cleanups = []

    // cursor follower
    const follower = document.querySelector('.cursor-item')
    if (follower) {
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
      let rafId

      function lerp(start, end, factor) {
        return (1 - factor) * start + factor * end
      }

      const stiffness = 0.1
      const damping = 0.55
      const rotationSensitivity = 0.1

      function animate() {
        const dx = targetX - currentX
        const dy = targetY - currentY

        velocityX += dx * stiffness
        velocityY += dy * stiffness

        velocityX *= damping
        velocityY *= damping

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

        // Idle-stop: once the follower has settled, park the loop instead of
        // writing transforms every frame forever; mousemove/hover wakes it.
        const settled =
          Math.abs(dx) < 0.1 &&
          Math.abs(dy) < 0.1 &&
          Math.abs(velocityX) < 0.01 &&
          Math.abs(velocityY) < 0.01 &&
          Math.abs(rotation) < 0.1 &&
          Math.abs(currentOpacity - targetOpacity) < 0.005
        rafId = settled ? 0 : requestAnimationFrame(animate)
      }
      const wake = () => {
        if (!rafId) rafId = requestAnimationFrame(animate)
      }
      animate()

      const onMove = (e) => {
        targetX = e.clientX
        targetY = e.clientY
        wake()
      }
      document.addEventListener('mousemove', onMove)

      const enterLeavePairs = []
      document.querySelectorAll('[data-cursor]').forEach((element) => {
        const onEnter = () => {
          follower.style.display = 'flex'
          targetOpacity = 1
          const cursorText = element.getAttribute('data-cursor')
          const cursorTextElement = document.querySelector('[data-cursor-text]')
          if (cursorText && cursorTextElement) {
            cursorTextElement.textContent = cursorText
          }
          wake()
        }
        const onLeave = () => {
          targetOpacity = 0
          wake()
        }
        element.addEventListener('mouseenter', onEnter)
        element.addEventListener('mouseleave', onLeave)
        enterLeavePairs.push([element, onEnter, onLeave])
      })

      cleanups.push(() => {
        cancelAnimationFrame(rafId)
        document.removeEventListener('mousemove', onMove)
        enterLeavePairs.forEach(([el, onEnter, onLeave]) => {
          el.removeEventListener('mouseenter', onEnter)
          el.removeEventListener('mouseleave', onLeave)
        })
        follower.style.opacity = 0
      })
    }

    // press inset
    document.querySelectorAll('.slider_wrap').forEach((wrap) => {
      const items = wrap.querySelectorAll('.slider_item-w')
      if (!items.length) return

      gsap.set(items, { clipPath: 'inset(0rem round 1rem)' }) // numeric baseline to interpolate

      const press = () =>
        gsap.to(items, { clipPath: 'inset(.25rem round 1rem)', duration: 0.4, ease: 'power3.out' })
      const release = () =>
        gsap.to(items, { clipPath: 'inset(0rem round 1rem)', duration: 0.4, ease: 'power3.out' })

      wrap.addEventListener('pointerdown', press)
      // release on window (pointer may leave)
      window.addEventListener('pointerup', release)
      window.addEventListener('pointercancel', release)

      cleanups.push(() => {
        wrap.removeEventListener('pointerdown', press)
        window.removeEventListener('pointerup', release)
        window.removeEventListener('pointercancel', release)
        gsap.set(items, { clearProps: 'clipPath' })
      })
    })

    return () => cleanups.forEach((fn) => fn())
  })
}

function initCompareToggle() {
  const EASE = 'hazel-ease' // retune toggle here
  const DURATION = 0.5
  const SWAP = '1.5rem' // column swap throw

  document.querySelectorAll('.compare_component').forEach((component) => {
    const buttons = [...component.querySelectorAll('[data-toggle]')]
    const bg = component.querySelector('.toggle_bg')
    const items = {
      after: component.querySelector('.compare_item.is--hazel'),
      before: component.querySelector('.compare_item.is--before'),
    }
    if (buttons.length < 2 || !items.after || !items.before) return

    gsap.matchMedia().add('(max-width: 480px)', () => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      let current = null

      function setStatus(status, animate) {
        if (status === current || !items[status]) return
        current = status
        component.setAttribute('data-compare-status', status)

        const index = buttons.findIndex((b) => b.getAttribute('data-toggle') === status)
        buttons.forEach((b, i) => b.classList.toggle('is--active', i === index))

        const d = animate && !reduce ? DURATION : 0
        const incoming = items[status]
        const outgoing = status === 'after' ? items.before : items.after

        if (bg) gsap.to(bg, { xPercent: index * 100, duration: d, ease: EASE })
        gsap.to(outgoing, {
          y: `-${SWAP}`,
          autoAlpha: 0,
          pointerEvents: 'none',
          duration: d,
          ease: EASE,
        })
        gsap.fromTo(
          incoming,
          { y: SWAP },
          { y: 0, autoAlpha: 1, pointerEvents: 'auto', duration: d, ease: EASE }
        )
      }

      const onClick = (e) => setStatus(e.currentTarget.getAttribute('data-toggle'), true)
      buttons.forEach((b) => b.addEventListener('click', onClick))

      setStatus('after', false) // default on load

      return () => {
        buttons.forEach((b) => {
          b.removeEventListener('click', onClick)
          b.classList.remove('is--active')
        })
        component.removeAttribute('data-compare-status')
        gsap.set([items.after, items.before, bg].filter(Boolean), { clearProps: 'all' })
      }
    })
  })
}

const initNotificationBanner = () => {
  const KEY = 'nav-banner-dismissed'
  const ONE_DAY = 24 * 60 * 60 * 1000
  const wrap = document.querySelector('.nav-banner_wrap')
  const btn = document.querySelector('.nav-banner_close-btn')
  if (!wrap || !btn) return
  const stored = localStorage.getItem(KEY)
  if (stored && Date.now() - Number(stored) < ONE_DAY) {
    wrap.remove()
    return
  }
  btn.addEventListener('click', function () {
    wrap.classList.add('is--closing')
    localStorage.setItem(KEY, Date.now().toString())
    setTimeout(function () {
      wrap.remove()
    }, 500)
  })
}

const initParallax = (container = document) => {
  if (!container.querySelector('.parallax, .parallax-large')) return

  const mm = gsap.matchMedia()
  mm.add(MQ.tabletUp, () => {
    container.querySelectorAll('.parallax, .parallax-large').forEach((parallaxImg) => {
      const parallaxParent = parallaxImg.parentElement
      if (!parallaxImg) return

      const yPercent = parallaxImg.classList.contains('parallax-large') ? 24 : 14

      gsap
        .timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: parallaxParent,
            start: 'clamp(top bottom)',
            end: 'bottom top',
            scrub: true,
            invalidateOnRefresh: true,
          },
        })
        .to(parallaxImg, { yPercent })
    })
  })
}

// Role -> default sequence. `at` = timeline position (s). Pieces opt in with a
// per-role attribute, data-hero-<role>; the role supplies default order/preset/
// timing so a hero needs no other attributes. Values reproduce the prior timing.
const HERO_SEQUENCE = {
  // image is the LCP element: earlier + shorter keeps LCP ~1.4s (was 2.8s)
  img: { at: 0.2, preset: 'rise', dur: 1.2 },
  title: { at: 0.5, preset: 'highlight' },
  text: { at: 0.8, preset: 'fade', dur: 0.6, y: '1rem' },
  list: { at: 0.9, preset: 'fade', dur: 0.6, y: '1rem', stagger: 0.1 },
  buttons: { at: 1.0, preset: 'fade', dur: 0.5, y: '1rem', stagger: 0.08 },
  form: { at: 1.1, preset: 'fade', dur: 0.6, y: '1rem' },
  testimonial: { at: 1.2, preset: 'fade', dur: 0.6, y: '1rem' },
  eyebrow: { at: 1.35, preset: 'fade', dur: 1, y: '0.5rem' },
  type: { at: 1.35, preset: 'typewriter' },
}

// Per-page-type overrides keyed by the data-hero-intro value; list only the
// roles that differ from HERO_SEQUENCE.
const HERO_VARIANTS = {}

const heroPreset = (preset, els, cfg, tl) => {
  const at = cfg.at ?? 0
  if (preset === 'highlight') {
    const el = els[0]
    let played = false
    SplitText.create(el, {
      type: 'lines, words, chars',
      autoSplit: true,
      onSplit(split) {
        // resize re-splits land here too: rewrap only, don't replay the intro
        if (played) return
        played = true
        highlightFill(el, split, tl, at, 0) // hide chars first (no flash)
        gsap.set(el, { autoAlpha: 1 })
      },
    })
  } else if (preset === 'typewriter') {
    els.forEach((el) => {
      const tw = typewriterPrep(el)
      tl.to(tw.chars, tw.vars, at)
    })
  } else if (preset === 'rise') {
    gsap.set(els, { autoAlpha: 0, yPercent: 40, scale: 1.05 })
    tl.to(els, { autoAlpha: 1, yPercent: 0, scale: 1, duration: cfg.dur ?? 1.2, ease: 'power4.out', stagger: cfg.stagger }, at)
  } else {
    // fade
    gsap.set(els, { autoAlpha: 0, y: cfg.y ?? '1rem' })
    tl.to(els, { autoAlpha: 1, y: 0, duration: cfg.dur ?? 0.6, stagger: cfg.stagger }, at)
  }
}

const initHeroIntro = () => {
  const hero = document.querySelector('[data-hero-intro]')
  if (!hero) return

  // each role is its own attribute (data-hero-<role>); same role on N elements
  // = one staggered group
  const groups = new Map()
  for (const role of Object.keys(HERO_SEQUENCE)) {
    const els = hero.querySelectorAll(`[data-hero-${role}]`)
    if (els.length) groups.set(role, [...els])
  }
  if (!groups.size) return

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.set([...groups.values()].flat(), { autoAlpha: 1 })
    return
  }

  const variant = HERO_VARIANTS[hero.getAttribute('data-hero-intro')] || {}
  const num = (el, attr) => {
    const v = parseFloat(el.getAttribute(attr))
    return Number.isFinite(v) ? v : undefined
  }
  const resolve = (role, el) => {
    const cfg = { ...HERO_SEQUENCE[role], ...variant[role] }
    const order = num(el, 'data-hero-order')
    if (order !== undefined) cfg.at = order
    const delay = num(el, 'data-hero-delay')
    if (delay !== undefined) cfg.at = (cfg.at ?? 0) + delay
    const preset = el.getAttribute('data-hero-preset')
    if (preset) cfg.preset = preset
    return cfg
  }

  const build = () => {
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } })
    groups.forEach((els, role) => {
      const cfg = resolve(role, els[0])
      heroPreset(cfg.preset || 'fade', els, cfg, tl)
    })
    tl.play()
  }

  // wait for fonts always; bg image only if data-hero-reveal is present (animated hero may not ship)
  const heroMedia = document.querySelector('[data-hero-reveal]')?.getAttribute('data-hero-media')
  const decoded = heroMedia
    ? Object.assign(new Image(), { src: heroMedia })
        .decode()
        .catch(() => {})
    : Promise.resolve()

  Promise.race([
    Promise.all([document.fonts?.ready ?? Promise.resolve(), decoded]),
    new Promise((resolve) => setTimeout(resolve, 0)),
  ]).then(build)
}

export function initGlobal() {
  CustomEase.create('hazel-ease', 'M0,0 C0.0846,-0.0003 0,1 1,1')
  initTextAnimations()
  initTitleAnimation()
  initMarqueeScrollDirection()

  initNumbersAnimation2()
  initButton()

  initLineRevealTestimonials()

  initFaqs()

  initPriceCards()
  initCompareToggle()
  initHeroParallax()
  initTabs()
  initTypewriter()
  initHeroIntro()

  initFooterGradient()

  initAnimateCards()
  initCursor()

  initNotificationBanner()

  initParallax()
}
