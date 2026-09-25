/*
 * The scroll-linked motion on this site: smooth wheel scrolling and the hero's parallax. Sections
 * call these; they never import gsap or build a ScrollTrigger themselves, so the reduced-motion
 * and touch guards below cannot be bypassed. Parts playing in as they come into view are CSS,
 * driven by src/lib/reveal.ts.
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
 * Trigger positions are measured when the parallax registers, before the images below have loaded
 * and taken their space. ScrollTrigger refreshes on resize by itself — debounced, and ignoring the
 * iOS toolbar showing and hiding; a resize listener of our own would recompute on every one.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => ScrollTrigger.refresh())
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

/** How far from its target a touch scroll still glides, in screen heights. */
const TOUCH_GLIDE_SCREENS = 1.2

/**
 * Scroll the page to an absolute position, through Lenis when it is running. On a touch device it
 * jumps to within a screen or so of the target and glides the rest: a scripted smooth scroll across
 * the whole page outruns what a phone can draw and flew through white screens on an iPhone, while a
 * glide that short is drawn in time and still reads as the page travelling.
 */
export function scrollToPosition(y: number): void {
  if (lenis) {
    lenis.scrollTo(y, { immediate: prefersReducedMotion() })
    return
  }
  if (prefersReducedMotion()) {
    window.scrollTo({ top: y, behavior: 'instant' })
    return
  }
  if (isTouchFirst()) {
    const glide = window.innerHeight * TOUCH_GLIDE_SCREENS
    const distance = window.scrollY - y
    if (Math.abs(distance) > glide) window.scrollTo({ top: y + Math.sign(distance) * glide, behavior: 'instant' })
  }
  window.scrollTo({ top: y, behavior: 'smooth' })
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
