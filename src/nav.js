function initScrollBehavior() {
  const nav = document.querySelector('.nav')
  if (!nav) return

  const offsetY = 60
  const scrollThreshold = offsetY + 950
  let oldScroll = 0

  function update() {
    const scrollY = window.scrollY

    nav.classList.toggle('is--scrolled', scrollY > offsetY)

    const shouldHide =
      scrollY > scrollThreshold && scrollY > oldScroll && nav.classList.contains('is--scrolled')
    nav.classList.toggle('is--scrolled-full', shouldHide)

    oldScroll = scrollY
  }

  // Initial check
  update()

  // Listen for scroll
  window.addEventListener('scroll', update, { passive: true })
}

export const initNav = () => {
initScrollBehavior()
}