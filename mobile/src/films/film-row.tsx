import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { displayTitle, type TitleMode } from "@readograph/core/display";
import type { Film } from "@readograph/core/data";
import type { Href } from "expo-router";
import { Poster } from "@/ui/poster";
import { Text } from "@/ui/text";
import { colors, space, thumbnail } from "@/ui/tokens";
import { DetailLink, ZoomSource } from "./detail-link";
import type { NextScreening } from "./present";

/** One row's height: 14 + 72 (thumbnail) + 14, the mock-up's 100-point rows. */
export const ROW_HEIGHT = 100;

export type FilmRowProps = {
  film: Film;
  titleMode: TitleMode;
  director: string;
  next: NextScreening | null;
  rating: { short: string; value: string };
  /** Radar's line under the title: "Only 2 screenings listed · 14 November 2026". */
  note?: string;
  href: Href;
  canOpen?: () => boolean;
  /** The morph overlay draws the row's text without its poster. */
  posterHidden?: boolean;
};

/**
 * A Films list row (mock-up 1): the 48×72 poster thumbnail, then the website's two-line
 * layout: title and original title, director and year, the next screening, and the rating at
 * the right edge.
 *
 * The List ⇄ Posters morph places its overlay poster on the thumbnail: a `Poster` with the
 * film ID as its `recyclingKey`, the component the grid renders, at a fixed 16-point left inset
 * and 14 points from the row's top (`rowThumbnailRect` in morph.ts).
 */
export const FilmRow = memo(function FilmRow({
  film,
  titleMode,
  director,
  next,
  rating,
  note,
  href,
  canOpen,
  posterHidden,
}: FilmRowProps) {
  const title = displayTitle(film, titleMode);
  const original = titleMode === "both" && film.o_ti && film.o_ti !== film.ti ? film.o_ti : null;
  const label = [
    title,
    original,
    director,
    note,
    next ? `Next: ${next.when}, ${next.where}` : null,
    `${rating.short} ${rating.value}`,
  ]
    .filter(Boolean)
    .join(". ");
  const body = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the film's screenings"
      disabled={posterHidden}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {posterHidden ? (
        <View style={thumbnail} />
      ) : (
        <ZoomSource>
          <Poster film={film} width={thumbnail.width} height={thumbnail.height} />
        </ZoomSource>
      )}
      <View style={styles.text}>
        <Text size={5} numberOfLines={2}>
          {title}
        </Text>
        {original ? (
          <Text tone="muted" numberOfLines={1}>
            {original}
          </Text>
        ) : null}
        {director ? (
          <Text tone="muted" numberOfLines={1} style={styles.director}>
            {director}
          </Text>
        ) : null}
        {note ? (
          <Text size={2} tone="brass" numberOfLines={2} style={styles.next}>
            {note}
          </Text>
        ) : null}
        {next ? (
          <Text size={2} numberOfLines={1} style={styles.next}>
            <Text size={2} weight="medium" tone="brass">
              {next.when}
            </Text>{" "}
            {next.where}
          </Text>
        ) : null}
      </View>
      <Text tone="muted" style={styles.rating}>
        {rating.short} <Text weight="medium">{rating.value}</Text>
      </Text>
    </Pressable>
  );
  return posterHidden ? (
    body
  ) : (
    <DetailLink href={href} canOpen={canOpen}>
      {body}
    </DetailLink>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: space.m,
    minHeight: ROW_HEIGHT,
    paddingVertical: 14,
    paddingHorizontal: space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rowLine,
  },
  pressed: { backgroundColor: colors.panel },
  text: { flex: 1, minWidth: 0 },
  director: { marginTop: 2 },
  next: { marginTop: space.xs },
  rating: { flexShrink: 0 },
});
