import { Easing, ReduceMotion, type WithTimingConfig } from "react-native-reanimated";
import { duration } from "./motion-values";

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

export { duration, morphDelay } from "./motion-values";

/**
 * The switches for PR 5's transitions, one constant each (recorded in docs/mobile.md).
 *
 * - `MORPH_STYLE`: "flip" is the List ⇄ Posters FLIP overlay; "crossFade" is the plan's
 *   fallback if the device checks find dropped frames: a 160 ms fade between the two layouts
 *   with the scroll anchor kept. Reduced motion always uses the 120 ms cross-fade.
 * - `IOS_POSTER_TRANSITION`: "zoom" uses Expo Router's `Link.AppleZoom` (iOS 18 and later;
 *   earlier iOS gets the push by itself); "push" turns it off.
 * - `ANDROID_POSTER_TRANSITION`: the container transform needs Reanimated shared-element
 *   transitions, which 4.5.1 still keeps behind the experimental static flag
 *   `ENABLE_SHARED_ELEMENT_TRANSITIONS`. So Android uses the plan's fallback, "fade": the
 *   standard push with the detail poster fading in over 160 ms. "push" turns the fade off.
 */
export const MORPH_STYLE: "flip" | "crossFade" = "flip";
export const IOS_POSTER_TRANSITION: "zoom" | "push" = "zoom";
export const ANDROID_POSTER_TRANSITION: "fade" | "push" = "fade";
