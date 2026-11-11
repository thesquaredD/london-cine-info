/**
 * The motion durations, kept free of React Native imports so the pure morph maths
 * (`films/morph.ts`) can be unit-tested in Node. `motion.ts` re-exports them.
 */

/** Durations in milliseconds. */
export const duration = {
  /** One poster's flight in the List ⇄ Posters morph (PR 5). */
  morph: 320,
  /** Delay between posters in reading order during the morph (PR 5). */
  morphStagger: 14,
  /** Row text fading out (to posters) or in (back to the list) during the morph (PR 5). */
  morphText: 160,
  /** Android poster fade when the container transform falls back to a push (PR 5). */
  posterFade: 160,
  /** The List ⇄ Posters fallback when `MORPH_STYLE` is "crossFade" (PR 5). */
  morphCrossFade: 160,
  /** The reduced-motion replacement for any transition that must stay visible. */
  crossFade: 120,
} as const;

/** The delay for the poster at `index` (reading order) in a morph of `count` posters. */
export function morphDelay(index: number, count: number, toPosters: boolean): number {
  const position = toPosters ? index : count - 1 - index;
  return Math.max(0, position) * duration.morphStagger;
}
