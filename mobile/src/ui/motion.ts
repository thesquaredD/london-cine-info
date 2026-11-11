import { Easing, ReduceMotion, type WithTimingConfig } from "react-native-reanimated";

/**
 * The app's motion rules (plan: "Shared motion rules").
 *
 * - Custom motion runs on the UI thread with Reanimated 4 and uses one easing, the website's
 *   `cubic-bezier(0.2, 0.8, 0.2, 1)`.
 * - Native transitions (sheets, pushes, the iOS zoom) keep their system curves and are not
 *   configured here.
 * - Every animation passes `ReduceMotion.System`: with the system setting on, Reanimated jumps
 *   to the end value. Where a change still needs to read as a change, use `crossFade` instead.
 */

/** The website's easing curve, for every custom animation. */
export const easing = Easing.bezier(0.2, 0.8, 0.2, 1);

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
  /** The reduced-motion replacement for any transition that must stay visible. */
  crossFade: 120,
} as const;

/** Timing config for custom motion. */
export function timing(ms: number): WithTimingConfig {
  return { duration: ms, easing, reduceMotion: ReduceMotion.System };
}

/** The 120 ms cross-fade used instead of movement when reduced motion is on. */
export const crossFade: WithTimingConfig = {
  duration: duration.crossFade,
  easing: Easing.linear,
  reduceMotion: ReduceMotion.Never,
};

/** The delay for the poster at `index` (reading order) in a morph of `count` posters. */
export function morphDelay(index: number, count: number, toPosters: boolean): number {
  const position = toPosters ? index : count - 1 - index;
  return Math.max(0, position) * duration.morphStagger;
}
