import { Image } from "expo-image";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { Film } from "@readograph/core/data";
import { colors, radius } from "./tokens";

/**
 * A film poster. The list thumbnail, the PR 5 poster grid and morph overlay, and the detail
 * poster all render this component with the same `source` and `recyclingKey` (the film ID), so
 * the decoded image is shared and nothing flickers when one turns into another.
 */
export function Poster({
  film,
  width,
  height,
  style,
}: {
  film: Pick<Film, "id" | "po">;
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.frame, { width, height }, style]}>
      {film.po ? (
        <Image
          source={posterSource(film.po, width)}
          recyclingKey={film.id}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

/**
 * The catalogue's posters are TMDB `w342` images; a thumbnail asks for `w185` (as the website's
 * `srcset` does), the grid and detail keep `w342`.
 */
export function posterSource(url: string, width: number): string {
  if (width > 92) return url;
  return url.replace(/^(https:\/\/image\.tmdb\.org\/t\/p\/)w342\//, "$1w185/");
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.shade, borderRadius: radius, overflow: "hidden" },
});
