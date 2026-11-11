import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { Href } from "expo-router";
import { displayTitle, type TitleMode } from "@readograph/core/display";
import type { Film } from "@readograph/core/data";
import { Poster } from "@/ui/poster";
import { Text } from "@/ui/text";
import { colors, space } from "@/ui/tokens";
import { DetailLink, ZoomSource } from "./detail-link";
import { GRID, gridInset } from "./morph";

/**
 * One poster in the Posters view: 2:3, inset 16, 8 or 0 points in its column so the grid has
 * 16 at the screen edges and 8 between posters, and 8 above. A film without a poster shows its
 * title and year on the panel colour, as the website's poster fallback does.
 */
export const PosterCell = memo(function PosterCell({
  film,
  column,
  posterWidth,
  titleMode,
  href,
  canOpen,
}: {
  film: Film;
  column: number;
  posterWidth: number;
  titleMode: TitleMode;
  href: Href;
  canOpen?: () => boolean;
}) {
  const title = displayTitle(film, titleMode);
  const height = posterWidth * 1.5;
  return (
    <View style={[styles.cell, { paddingLeft: gridInset(column) }]}>
      <DetailLink href={href} canOpen={canOpen}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[title, film.ye].filter(Boolean).join(", ")}
          accessibilityHint="Opens the film's screenings"
          style={({ pressed }) => [{ width: posterWidth, height }, pressed && styles.pressed]}
        >
          <ZoomSource>
            <Poster film={film} width={posterWidth} height={height} />
          </ZoomSource>
          {film.po ? null : (
            <View style={styles.fallback} pointerEvents="none">
              <Text size={2} weight="medium" numberOfLines={4}>
                {title}
              </Text>
              {film.ye ? (
                <Text size={1} tone="muted">
                  {film.ye}
                </Text>
              ) : null}
            </View>
          )}
        </Pressable>
      </DetailLink>
    </View>
  );
});

const styles = StyleSheet.create({
  cell: { paddingTop: GRID.gap },
  pressed: { opacity: 0.8 },
  fallback: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "flex-end",
    padding: space.s,
    backgroundColor: colors.shade,
  },
});
