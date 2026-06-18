import { initHeroShader } from '../shaders/heroShader'

CustomEase.create('main', 'M0,0 C0.649,0 0,1 1,1 ')

const initHomeHero = () => {
  // const tl = gsap.timeline({ defaults: { duration: 2, ease: 'power3.out' } })
  // tl.fromTo(
  //   '.home-h_mask',
  //   { y: '20vh', scale: 1.05, opacity: 0 },
  //   { y: '0vh', scale: 1, opacity: 1, duration: 3, ease: 'main' }
  // ).from('.home-h_img', { y: '100vh' }, '<.1')
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

const initIconCards = () => {
  document.querySelectorAll('[data-animate-cards]').forEach((el) => {
    const trigger = el.querySelector('.icon-card_item').parentElement
    const cards = el.querySelectorAll('.icon-card_item')

    gsap.from(cards, {
      y: '8rem',
      ease: 'power4.out',
      duration: 1.8,
      stagger: 0.05,
      scrollTrigger: {
        trigger: trigger,
        start: 'clamp(top 90%)',
        once: true,
      },
    })
  })
}

const initRace = () => {
  const el = document.querySelector('.why-now_visual-w')
  const itemsUneven = el.querySelectorAll('.why-now_item.is--uneven')
  const itemsEven = el.querySelectorAll('.why-now_item.is--even')

  const tl = gsap.timeline({
    defaults: { duration: 2.5, ease: 'power4.out' },
    scrollTrigger: {
      trigger: el,
      start: 'clamp(top 90%)',
      once: true,
    },
  })

  tl.from(itemsUneven, {
    x: '-8rem',
    stagger: 0,
  })

  tl.from(
    itemsEven,
    {
      x: '-12rem',
      stagger: 0,
    },
    0
  )
  tl.from(
    '.why-now_item.is--highlight',
    {
      x: '-20rem',
    },
    0
  )
  const lines = el.querySelectorAll('.why-now_item .why-now_line')
  tl.from(
    lines,
    {
      scaleX: 2,
      duration: 2,
      stagger: (index, target) => {
        const isHighlight = target.closest('.why-now_item').classList.contains('is--highlight')
        return index * 0.01 + (isHighlight ? 0.1 : 0)
      },
    },
    0
  )
}

export function initHome() {
  // initHeroShader()
  initHomeHero()
  initHighlightText()
  initIconCards()
  initRace()
  console.log('hi home')
}
