import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import type { Film } from "@readograph/core/data";
import { Poster } from "@/ui/poster";
import {
  flightProgress,
  mixRect,
  rowTextOpacity,
  type Flight,
  type MorphPlan,
  type Rect,
} from "./morph";

/** The website's curve as a function the UI thread can call per poster. */
const ease = Easing.bezierFn(0.2, 0.8, 0.2, 1);

export type TextGhost = { key: string; film: Film; rect: Rect };

/**
 * The FLIP overlay (plan: "List ⇄ posters morph", step 3): every visible poster drawn at its
 * start rectangle and moved to its target with `left`, `top`, `width` and `height`, plus the
 * list rows' text fading, all driven by one shared `progress` value on the UI thread. It never
 * takes touches; the list's cells are hidden underneath while it shows.
 */
export const MorphOverlay = memo(function MorphOverlay({
  plan,
  films,
  texts,
  progress,
  opacity,
  renderText,
}: {
  plan: MorphPlan | null;
  films: ReadonlyMap<string, Film>;
  texts: TextGhost[];
  progress: SharedValue<number>;
  opacity: SharedValue<number>;
  renderText: (film: Film) => ReactNode;
}) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!plan) return null;
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {texts.map((ghost) => (
        <TextGhostView
          key={ghost.key}
          ghost={ghost}
          plan={plan}
          progress={progress}
          renderText={renderText}
        />
      ))}
      {plan.flights.map((flight) => {
        const film = films.get(flight.key);
        return film ? (
          <FlightView
            key={flight.key}
            flight={flight}
            film={film}
            plan={plan}
            progress={progress}
          />
        ) : null;
      })}
    </Animated.View>
  );
});

function FlightView({
  flight,
  film,
  plan,
  progress,
}: {
  flight: Flight;
  film: Film;
  plan: MorphPlan;
  progress: SharedValue<number>;
}) {
  const { from, to, delay, fade } = flight;
  const total = plan.total;
  const style = useAnimatedStyle(() => {
    const t = flightProgress(progress.value, total, delay);
    const rect = mixRect(from, to, ease(t));
    return {
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
      opacity: fade === "none" ? 1 : fade === "in" ? t : 1 - t,
    };
  });
  // The overlay asks for the image the start layout already shows (the list's w185 thumbnail or
  // the grid's w342 poster), so it is decoded before the first frame; the target layout loads
  // its own size underneath while the posters fly.
  return (
    <Animated.View style={[styles.flight, style]}>
      <Poster film={film} width={from.width} height={from.height} style={styles.fill} />
    </Animated.View>
  );
}

function TextGhostView({
  ghost,
  plan,
  progress,
  renderText,
}: {
  ghost: TextGhost;
  plan: MorphPlan;
  progress: SharedValue<number>;
  renderText: (film: Film) => ReactNode;
}) {
  const { total, toPosters } = plan;
  const style = useAnimatedStyle(() => ({
    opacity: rowTextOpacity(progress.value, total, toPosters),
  }));
  return (
    <Animated.View
      style={[
        styles.ghost,
        {
          left: ghost.rect.x,
          top: ghost.rect.y,
          width: ghost.rect.width,
          height: ghost.rect.height,
        },
        style,
      ]}
    >
      <View style={styles.fill}>{renderText(ghost.film)}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flight: { position: "absolute", overflow: "hidden" },
  ghost: { position: "absolute", overflow: "hidden" },
  fill: { width: "100%", height: "100%" },
});
