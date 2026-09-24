/*
 * One light over a group of cards. Each card draws the part of it that falls inside its own box,
 * so the glow crosses the gaps between cards instead of switching on and off, and it eases toward
 * the pointer rather than snapping to it — a firefly passing through, not a lamp being flicked.
 *
 * The card markup carries a `.glow-light` element; this sets where the light falls.
 */

import { prefersReducedMotion } from './motion'

/** How much of the remaining distance the light covers each frame. */
const EASE = 0.18

/** How far outside a card the light can sit and still touch it, in percent of the card. */
const REACH = { x: 55, y: 140 }

export function followGlow(container: HTMLElement | null, cards: HTMLElement[]): void {
  if (!container || cards.length === 0 || prefersReducedMotion()) return

  let pointer: { x: number; y: number } | null = null
  let light = { x: 0, y: 0 }
  let frame = 0

  const paint = () => {
    frame = 0
    if (!pointer) return

    light = { x: light.x + (pointer.x - light.x) * EASE, y: light.y + (pointer.y - light.y) * EASE }

    for (const card of cards) {
      const box = card.getBoundingClientRect()
      const x = ((light.x - box.left) / box.width) * 100
      const y = ((light.y - box.top) / box.height) * 100
      card.style.setProperty('--glow-x', `${x}%`)
      card.style.setProperty('--glow-y', `${y}%`)
      const near = x > -REACH.x && x < 100 + REACH.x && y > -REACH.y && y < 100 + REACH.y
      card.querySelector('.glow-light')?.classList.toggle('is-lit', near)
    }

    const settled = Math.abs(pointer.x - light.x) < 0.5 && Math.abs(pointer.y - light.y) < 0.5
    if (!settled) frame = requestAnimationFrame(paint)
  }

  container.addEventListener('pointermove', (event: PointerEvent) => {
    const first = pointer === null
    pointer = { x: event.clientX, y: event.clientY }
    // Entering from outside, the light starts where the pointer is instead of sliding in.
    if (first) light = { ...pointer }
    if (!frame) frame = requestAnimationFrame(paint)
  })
  container.addEventListener('pointerleave', () => {
    pointer = null
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    for (const card of cards) card.querySelector('.glow-light')?.classList.remove('is-lit')
  })
}
