/*
 * Plays the page in as it scrolls into view, once. Markup declares it:
 *   [data-reveal]         rises and fades in as it nears the viewport; `--i` staggers siblings
 *   [data-reveal="load"]  plays from CSS at first paint instead — the hero, on screen before any
 *                         script has run
 *   [data-live]           gets `is-off` while off screen, so its endless animations pause instead
 *                         of repainting every frame for nothing
 *
 * The HTML renders every final state. The hidden starting state hangs off <html class="motion">,
 * which an inline script in the head sets before first paint unless the reader asked for reduced
 * motion — so nothing is shown and then hidden, and without script nothing waits. Only opacity and
 * transform move, which the compositor runs without the main thread.
 */

const PENDING = '[data-reveal]:not([data-reveal="load"]):not(.is-in)'

let observer: IntersectionObserver | null = null

export function initReveal(): void {
  if (!document.documentElement.classList.contains('motion') || observer) return

  // A little below the fold, so a fast scroll finds each part already on its way in rather than
  // arriving at empty space.
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        observer?.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px 12% 0px' },
  )
  document.querySelectorAll(PENDING).forEach((el) => observer?.observe(el))

  const live = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.classList.toggle('is-off', !entry.isIntersecting)
  })
  document.querySelectorAll('[data-live]').forEach((el) => live.observe(el))
}

/** Shows everything still waiting, for a jump that would otherwise travel past empty sections. */
export function revealAll(): void {
  document.querySelectorAll(PENDING).forEach((el) => {
    el.classList.add('is-in')
    observer?.unobserve(el)
  })
}
