import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { Stack, useLocalSearchParams } from "expo-router";
import { DEFAULT_DISPLAY } from "@readograph/core/display";
import { filmProviderLinks } from "@readograph/core/film-links";
import { shareUrl } from "@readograph/core/sharing";
import { SITE_ORIGIN } from "@readograph/core/site";
import type { DataMeta, Film, FilmShowtimes, Showtime } from "@readograph/core/data";
import { useCatalogue, useCatalogueStore } from "@/catalogue/provider";
import { CatalogueStatus } from "@/catalogue/status";
import {
  bookingLabel,
  dayHeading,
  factsLine,
  genreLine,
  ratingViews,
  screeningDays,
  screeningTags,
} from "@/films/present";
import { ZoomTarget } from "@/films/detail-link";
import { useView } from "@/films/view-context";
import { useNow } from "@/films/use-now";
import { Notice } from "@/ui/notice";
import { openLink } from "@/ui/open-link";
import { Poster } from "@/ui/poster";
import { Text } from "@/ui/text";
import { ANDROID_POSTER_TRANSITION, duration } from "@/ui/motion";
import { colors, detailPoster, radius, space, touchTarget } from "@/ui/tokens";

/**
 * Android has no container transform yet (see `ANDROID_POSTER_TRANSITION`): the push carries the
 * screen and the poster fades in over 160 ms. With reduced motion it simply appears.
 */
const posterEntering =
  Platform.OS === "android" && ANDROID_POSTER_TRANSITION === "fade"
    ? FadeIn.duration(duration.posterFade).reduceMotion(ReduceMotion.System)
    : undefined;

/**
 * The film detail screen, pushed over the list: poster and facts, ratings with links, the
 * trailer, Letterboxd, IMDb and Share, then the screenings by day that match the list's
 * filters, each with its booking link in the in-app browser.
 */
export default function FilmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { catalogue } = useCatalogue();
  const film = catalogue?.films.find((item) => item.id === id);
  if (!catalogue || !film)
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: "Film" }} />
        {catalogue ? (
          <Notice
            title="This film is no longer listed"
            body="It has no screenings in the current listings."
          />
        ) : (
          <CatalogueStatus />
        )}
      </View>
    );
  return <FilmDetail film={film} meta={catalogue.meta} />;
}

function FilmDetail({ film, meta }: { film: Film; meta: DataMeta }) {
  const store = useCatalogueStore();
  const state = useView();
  const now = useNow();
  const [data, setData] = useState<FilmShowtimes | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setData(null);
    setFailed(false);
    store
      .loadShowtimes(film.id)
      .then((value) => active && setData(value))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [store, film.id, attempt]);

  const days = useMemo(
    () => (data ? screeningDays(data.days, meta, state, now) : []),
    [data, meta, state, now],
  );
  const venues = useMemo(() => new Map(meta.venues.map((venue) => [venue.id, venue.name])), [meta]);
  const ratings = ratingViews(film, DEFAULT_DISPLAY.ratingOrder);
  const [letterboxd, imdb] = filmProviderLinks(film);
  const original = film.o_ti && film.o_ti !== film.ti ? film.o_ti : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: film.ti }} />
      <View style={styles.top}>
        <ZoomTarget>
          <Animated.View entering={posterEntering}>
            <Poster film={film} width={detailPoster.width} height={detailPoster.height} />
          </Animated.View>
        </ZoomTarget>
        <View style={styles.facts}>
          <Text size={6} weight="medium" accessibilityRole="header">
            {film.ti}
          </Text>
          {original ? <Text tone="muted">{original}</Text> : null}
          {film.di.length ? (
            <Text style={styles.gap}>{film.di.map((director) => director.name).join(", ")}</Text>
          ) : null}
          {factsLine(film) ? <Text>{factsLine(film)}</Text> : null}
          {genreLine(film, meta) ? <Text tone="muted">{genreLine(film, meta)}</Text> : null}
        </View>
      </View>

      <View style={styles.ratings} accessibilityRole="list">
        {ratings.map((rating) => (
          <Pressable
            key={rating.key}
            disabled={!rating.url}
            onPress={() => rating.url && void openLink(rating.url)}
            accessibilityRole={rating.url ? "link" : "text"}
            accessibilityLabel={`${rating.name}: ${rating.value === "–" ? "not rated" : `${rating.value}${rating.scale}`}`}
            style={styles.rating}
          >
            <Text size={1} tone="muted">
              {rating.short}
            </Text>
            <Text size={4} weight="medium">
              {rating.value}
              <Text size={2} tone="muted">
                {rating.scale}
              </Text>
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        {film.tr ? <Action label="Trailer" onPress={() => void openLink(film.tr!)} /> : null}
        {letterboxd ? (
          <Action
            label="Letterboxd"
            hint={letterboxd.label}
            onPress={() => void openLink(letterboxd.href)}
          />
        ) : null}
        {imdb ? (
          <Action label="IMDb" hint={imdb.label} onPress={() => void openLink(imdb.href)} />
        ) : null}
        <Action
          label="Share"
          onPress={() => {
            const url = shareUrl(film, SITE_ORIGIN);
            void Share.share({ url, message: url, title: film.ti }).catch(() => undefined);
          }}
        />
      </View>

      {!data && !failed ? <Notice title="Loading screenings…" /> : null}
      {failed ? (
        <Notice
          title="Screening details could not be loaded."
          action={{ label: "Try again", onPress: () => setAttempt((value) => value + 1) }}
        />
      ) : null}
      {data && !days.length ? <Notice title="No screenings match these filters." /> : null}
      {days.map((day) => (
        <View key={day.date} accessibilityRole="list">
          <Text weight="medium" accessibilityRole="header" style={styles.day}>
            {dayHeading(day.date).toUpperCase()}
          </Text>
          {day.rows.map((row, index) => (
            <ScreeningLine
              key={`${row.time}-${row.venue}-${index}`}
              film={film}
              row={row}
              venue={venues.get(row.venue) ?? row.venue}
              tags={screeningTags(row, meta)}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function Action({ label, hint, onPress }: { label: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ?? label}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Text>{label}</Text>
    </Pressable>
  );
}

function ScreeningLine({
  film,
  row,
  venue,
  tags,
}: {
  film: Film;
  row: Showtime;
  venue: string;
  tags: string[];
}) {
  const label = bookingLabel(row);
  return (
    <View style={styles.screening}>
      <View style={styles.screeningText}>
        <Text size={6} weight="medium">
          {row.localTime}
        </Text>
        <Text style={styles.venue}>{venue}</Text>
        {tags.length ? (
          <Text size={2} tone={row.soldOut ? "soldOut" : "muted"} style={styles.tags}>
            {tags.join(" · ")}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => void openLink(row.bookingUrl)}
        accessibilityRole="link"
        accessibilityLabel={`${label === "Book" ? "Book" : "Screening details for"} ${film.ti} at ${venue} ${row.localTime}`}
        style={({ pressed }) => [
          styles.book,
          label === "Details" && styles.details,
          pressed && styles.bookPressed,
        ]}
      >
        <Text tone={label === "Book" ? "onRed" : "fg"}>{label} ↗</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, paddingBottom: space.xxxl * 2 },
  top: { flexDirection: "row", gap: space.l },
  facts: { flex: 1, minWidth: 0, gap: space.xs },
  gap: { marginTop: space.xs },
  ratings: { flexDirection: "row", gap: space.s, marginTop: space.xl },
  rating: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: radius,
    paddingVertical: 10,
    paddingHorizontal: space.s,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.s, marginTop: space.m },
  action: {
    flexBasis: "48%",
    flexGrow: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pressed: { backgroundColor: colors.shade },
  day: {
    marginTop: 28,
    paddingBottom: 10,
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: colors.brassRuleSoft,
  },
  screening: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.m,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rowLine,
  },
  screeningText: { flex: 1, minWidth: 0 },
  venue: { marginTop: space.s },
  tags: { marginTop: space.xs },
  book: {
    minHeight: 48,
    minWidth: touchTarget,
    paddingHorizontal: space.l,
    justifyContent: "center",
    borderRadius: radius,
    backgroundColor: colors.red,
  },
  details: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
  bookPressed: { opacity: 0.8 },
});
