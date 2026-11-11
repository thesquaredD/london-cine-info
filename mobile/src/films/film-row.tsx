import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { displayTitle, type TitleMode } from "@readograph/core/display";
import type { Film } from "@readograph/core/data";
import { Poster } from "@/ui/poster";
import { Text } from "@/ui/text";
import { colors, space, thumbnail } from "@/ui/tokens";
import type { NextScreening } from "./present";

/** One row's height: 14 + 72 (thumbnail) + 14, the mock-up's 100-point rows. */
export const ROW_HEIGHT = 100;

export type FilmRowProps = {
  film: Film;
  titleMode: TitleMode;
  director: string;
  next: NextScreening | null;
  rating: { short: string; value: string };
  onOpen: (film: Film) => void;
};

/**
 * A Films list row (mock-up 1): the 48×72 poster thumbnail, then the website's two-line
 * layout: title and original title, director and year, the next screening, and the rating at
 * the right edge.
 *
 * PR 5's List ⇄ Posters morph measures the thumbnail: it is a `Poster` with the film ID as its
 * `recyclingKey`, the same component the grid will render, at a fixed 16-point left inset.
 */
export const FilmRow = memo(function FilmRow({
  film,
  titleMode,
  director,
  next,
  rating,
  onOpen,
}: FilmRowProps) {
  const title = displayTitle(film, titleMode);
  const original = titleMode === "both" && film.o_ti && film.o_ti !== film.ti ? film.o_ti : null;
  const label = [
    title,
    original,
    director,
    next ? `Next: ${next.when}, ${next.where}` : null,
    `${rating.short} ${rating.value}`,
  ]
    .filter(Boolean)
    .join(". ");
  return (
    <Pressable
      onPress={() => onOpen(film)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the film's screenings"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Poster film={film} width={thumbnail.width} height={thumbnail.height} />
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
