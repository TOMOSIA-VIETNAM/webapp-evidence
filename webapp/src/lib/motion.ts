/*
 * Every animation on this site starts here. Sections call a preset; they never import
 * gsap or build a ScrollTrigger themselves, so the reduced-motion guard below cannot be
 * bypassed by a section that forgot about it.
 *
 * Contract of every preset: when the visitor asks for reduced motion, the preset puts the
 * element in its FINAL state immediately and registers nothing. The page must read the
 * same with motion off, only without the movement.
 */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

/*
 * Trigger positions are measured when a section registers, which is before the images below it
 * have loaded and taken up their space. Without this a section can sit at its start state forever
 * because the scroll never reaches where it thinks it is.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => ScrollTrigger.refresh())
  window.addEventListener('resize', () => ScrollTrigger.refresh())
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/*
 * A device driven by touch scrolls natively, on the compositor, and anything tied to that scroll by
 * script can only follow a frame behind it. The same media query drops the costlier glass in
 * tokens.css; keep the two in step.
 */
export const TOUCH_FIRST = '(hover: none), (pointer: coarse)'

export function isTouchFirst(): boolean {
  return window.matchMedia(TOUCH_FIRST).matches
}

/** A duration token from tokens.css in seconds, so JS and CSS never drift apart. */
function seconds(name: string, fallbackMs: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || `${fallbackMs}ms`
  return raw.endsWith('ms') ? parseFloat(raw) / 1000 : parseFloat(raw)
}

/** The iOS-leaning easing from tokens.css, expressed for gsap. */
const EASE_IOS = 'cubic-bezier(0.32, 0.72, 0, 1)'

let lenis: Lenis | null = null

/**
 * Smooth scrolling for the wheel. Does nothing under reduced motion, and nothing on a touch device:
 * Lenis leaves touch to the browser anyway, while its non-passive touch listeners make every swipe
 * wait on the main thread and walk the DOM for nested scrollers — the stutter a phone showed most
 * over the horizontally scrolling code panels.
 */
export function initSmoothScroll(): void {
  if (prefersReducedMotion() || isTouchFirst() || lenis) return
  lenis = new Lenis({ duration: 1.05, smoothWheel: true })
  const raf = (time: number) => {
    lenis?.raf(time)
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(raf)
  lenis.on('scroll', ScrollTrigger.update)
}

/** Scroll the page to an absolute position, through Lenis when it is running. */
export function scrollToPosition(y: number): void {
  if (lenis) lenis.scrollTo(y, { immediate: prefersReducedMotion() })
  else window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

/** Elements rise and fade in as they enter the viewport. */
export function fadeUp(targets: gsap.DOMTarget, options: { stagger?: number; distance?: number } = {}): void {
  const elements = gsap.utils.toArray<HTMLElement>(targets)
  if (elements.length === 0) return
  if (prefersReducedMotion()) {
    gsap.set(elements, { clearProps: 'all', opacity: 1, y: 0 })
    return
  }
  // A `from` tween re-applies its start values whenever ScrollTrigger refreshes, which leaves an
  // element that already played stuck at opacity 0. Setting the start state and animating to the
  // end state inside onEnter has no such state to lose.
  gsap.set(elements, { opacity: 0, y: options.distance ?? 24 })
  ScrollTrigger.create({
    trigger: elements[0],
    start: 'top 90%',
    once: true,
    onEnter: () =>
      gsap.to(elements, {
        opacity: 1,
        y: 0,
        duration: seconds('--duration-slow', 480),
        ease: EASE_IOS,
        stagger: options.stagger ?? 0.08,
      }),
  })
}

/**
 * One decorative layer drifting at its own speed while the page scrolls. Not on a touch device: a
 * transform scrubbed from script trails the native scroll there, and the layer visibly judders.
 */
export function parallaxLayer(target: gsap.DOMTarget, options: { distance?: number; scope?: Element } = {}): void {
  const elements = gsap.utils.toArray<HTMLElement>(target)
  if (elements.length === 0 || prefersReducedMotion() || isTouchFirst()) return
  for (const element of elements) {
    gsap.to(element, {
      yPercent: options.distance ?? -18,
      ease: 'none',
      scrollTrigger: {
        trigger: options.scope ?? element.parentElement ?? element,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.6,
      },
    })
  }
}
