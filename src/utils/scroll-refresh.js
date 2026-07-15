import { debounce } from './helpers.js'

// A refresh is a synchronous reflow; running it mid-scroll stalls momentum
// scrolling on mobile (the "scroll keeps stopping" bug). Every caller routes
// through this gate: if the user is scrolling, defer to one refresh once they
// pause.
let scrolling = null
let pending = false

addEventListener(
  'scroll',
  () => {
    clearTimeout(scrolling)
    scrolling = setTimeout(() => {
      scrolling = null
      if (pending) {
        pending = false
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh()
      }
    }, 200)
  },
  { passive: true }
)

export const requestScrollRefresh = debounce(() => {
  if (typeof ScrollTrigger === 'undefined') return
  if (scrolling) {
    pending = true
    return
  }
  ScrollTrigger.refresh()
}, 250)
