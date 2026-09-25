/*
 * Plays the page in as it scrolls into view. Markup declares it:
 *   [data-reveal]         rises and fades in as it comes into view; `--i` staggers siblings.
 *                         Where the browser supports scroll-driven animations this is CSS alone,
 *                         tied to scroll position; elsewhere this file plays it once
 *   [data-reveal="load"]  plays from CSS at first paint instead — the hero, on screen before any
 *                         script has run
 *   [data-live]           gets `is-off` while off screen, so the endless animations inside it,
 *                         marked [data-loop], pause instead of repainting every frame for nothing
 *
 * The HTML renders every final state. The hidden starting state hangs off <html class="motion">,
 * which an inline script in the head sets before first paint unless the reader asked for reduced
 * motion — so nothing is shown and then hidden, and without script nothing waits. Only opacity and
 * transform move, which the compositor runs without the main thread.
 */

const PENDING = '[data-reveal]:not([data-reveal="load"]):not(.is-in)'

let observer: IntersectionObserver | null = null
let started = false

export function initReveal(): void {
  if (!document.documentElement.classList.contains('motion') || started) return
  started = true

  const live = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.classList.toggle('is-off', !entry.isIntersecting)
  })
  document.querySelectorAll('[data-live]').forEach((el) => live.observe(el))

  // Where CSS ties the rise to scroll position (tokens.css), there is nothing to trigger.
  if (CSS.supports('animation-timeline: view()')) return

  // A quarter of a screen below the fold, so a fast scroll finds each part already on its way in
  // rather than arriving at empty space.
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        observer?.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px 25% 0px' },
  )
  document.querySelectorAll(PENDING).forEach((el) => observer?.observe(el))
}

/** Shows everything still waiting to be triggered, for a jump that would travel past it hidden. */
export function revealAll(): void {
  document.querySelectorAll(PENDING).forEach((el) => {
    el.classList.add('is-in')
    observer?.unobserve(el)
  })
}
