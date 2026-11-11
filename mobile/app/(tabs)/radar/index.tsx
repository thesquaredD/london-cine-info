import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { formatDate, type SortKey } from "@readograph/core/catalogue";
import { DEFAULT_DISPLAY } from "@readograph/core/display";
import { isFilmFormat, isImaxFormat, screeningMatcher } from "@readograph/core/filters";
import type { Film } from "@readograph/core/data";
import { useCatalogue, useCatalogueStore } from "@/catalogue/provider";
import { CatalogueStatus } from "@/catalogue/status";
import { detailHref } from "@/films/detail-link";
import { ResultsBar } from "@/films/discovery-bar";
import { FilmRow } from "@/films/film-row";
import { directorLine, nextScreening, rowRating } from "@/films/present";
import { SortMenu } from "@/films/sort-menu";
import { useNow } from "@/films/use-now";
import { useView, useViewStore } from "@/films/view-context";
import { SORT_KEYS } from "@/films/view-store";
import {
  radarIndex,
  radarResults,
  radarSection,
  resultLabel,
  type RadarSection,
} from "@/filters/results";
import { SearchAndFilters } from "@/filters/search-and-filters";
import { Banner, Notice } from "@/ui/notice";
import { Segmented } from "@/ui/segmented";
import { Text } from "@/ui/text";
import { colors, space } from "@/ui/tokens";

const SECTIONS = [
  { value: "limited", label: "Few screenings soon" },
  { value: "film", label: "35mm & 70mm" },
  { value: "imax", label: "IMAX" },
] as const;
const NOTES: Record<RadarSection, string> = {
  limited: "1–3 screenings listed in total, with a bookable screening in the next 7 days.",
  film: "Explicit 35mm / 70mm screenings.",
  imax: "Explicit IMAX screenings; generic IMAX does not identify film projection.",
};
const GAUGES = [
  { value: "", label: "35mm & 70mm" },
  { value: "35mm", label: "35mm" },
  { value: "70mm", label: "70mm" },
] as const;
const RADAR_SORT: SortKey[] = ["opportunity", ...SORT_KEYS];

/**
 * The Radar tab, as the website's: films with few screenings left, or screenings in 35mm, 70mm
 * and IMAX, one section at a time, each film with the line that says why it is listed.
 */
export default function RadarScreen() {
  const { catalogue, error, updateRequired, refreshing } = useCatalogue();
  const catalogueStore = useCatalogueStore();
  const store = useViewStore();
  const state = useView();
  const now = useNow();
  const [aboutOpen, setAboutOpen] = useState(false);
  const section = radarSection(state);
  const gauge = state.filmGauge;

  const entries = useMemo(() => (catalogue ? radarIndex(catalogue, now) : []), [catalogue, now]);
  const films = useMemo(
    () => (catalogue ? radarResults(catalogue, entries, state, now) : []),
    [catalogue, entries, state, now],
  );
  // The website's line under each title: why the film is on Radar.
  const notes = useMemo(() => {
    if (!catalogue) return new Map<string, string>();
    const visible = new Set(films.map((film) => film.id));
    const sectionState = {
      ...state,
      radarSection: section,
      filmGauge: section === "film" ? gauge : undefined,
    };
    const matcher = screeningMatcher(catalogue.meta, sectionState, now);
    const special = (formats: string[]) =>
      section === "film" ? isFilmFormat(formats, gauge) : isImaxFormat(formats);
    return new Map(
      entries
        .filter((entry) => visible.has(entry.film.id))
        .map((entry) => {
          const relevant =
            section === "limited"
              ? entry.screenings
              : entry.special.filter((row) => special(row.formats) && matcher.row(row, entry.film));
          const formats = [
            ...new Set(
              relevant.flatMap((row) => row.formats).filter((format) => special([format])),
            ),
          ].map(
            (format) =>
              catalogue.meta.facets.format.find((option) => option.id === format)?.label ?? format,
          );
          const count = `${relevant.length} screening${relevant.length === 1 ? "" : "s"} listed`;
          const first = relevant[0] ? formatDate(relevant[0].date) : "";
          return [
            entry.film.id,
            `${section === "limited" ? "Only " : `${formats.join(" / ")} · `}${count} · ${first}`,
          ];
        }),
    );
  }, [catalogue, entries, films, state, section, gauge, now]);

  if (!catalogue)
    return (
      <View style={styles.screen}>
        <CatalogueStatus />
      </View>
    );

  const updated = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(catalogue.meta.generatedAt));
  const header = (
    <View>
      <Text style={styles.intro}>
        Find films with few screenings left, or screenings in 35mm, 70mm and IMAX.
      </Text>
      <Pressable
        onPress={() => setAboutOpen(!aboutOpen)}
        accessibilityRole="button"
        accessibilityState={{ expanded: aboutOpen }}
        style={styles.aboutToggle}
      >
        <Text size={2} tone="brass">
          {aboutOpen ? "▴" : "▾"} How Radar works · listing coverage
        </Text>
      </Pressable>
      {aboutOpen ? (
        <View style={styles.about}>
          <Text size={2} tone="muted">
            Counts cover all listed cinemas before your filters, include sold-out screenings and
            exclude starts that have passed. Programmes may be incomplete or change; few listings do
            not mean a definitive last chance. Generic IMAX does not identify digital versus film.
          </Text>
          <Text size={2} tone="muted">
            Updated {updated}. Listing horizon: {catalogue.meta.facets.day[0]?.id}–
            {catalogue.meta.facets.day.at(-1)?.id}.
          </Text>
        </View>
      ) : null}
      <SearchAndFilters scope="radar" />
      <Segmented
        label="Radar sections"
        options={SECTIONS}
        value={section}
        onChange={(value) => store.update({ radarSection: value, page: 1 })}
      />
      {section === "film" ? (
        <Segmented
          label="Film format"
          options={GAUGES}
          value={gauge ?? ""}
          onChange={(value) => store.update({ filmGauge: value || undefined, page: 1 })}
        />
      ) : null}
      {updateRequired ? (
        <Banner>New listings need the latest version of the app. Update it to see them.</Banner>
      ) : null}
      {error ? (
        <Banner>Showing saved listings. They will update when you are back online.</Banner>
      ) : null}
      <Text size={2} tone="muted" style={styles.note}>
        {NOTES[section]}
      </Text>
      <ResultsBar label={resultLabel("radar", films.length)}>
        <SortMenu state={state} onSort={store.sortBy} keys={RADAR_SORT} />
      </ResultsBar>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlashList
        data={films}
        keyExtractor={(film: Film) => film.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Notice
            title="Nothing on Radar matches"
            body="Try another section, fewer filters or a shorter search."
          />
        }
        refreshing={refreshing}
        onRefresh={() => void catalogueStore.refresh()}
        extraData={notes}
        renderItem={({ item }) => (
          <FilmRow
            film={item}
            titleMode={DEFAULT_DISPLAY.titleMode}
            director={directorLine(item)}
            note={notes.get(item.id)}
            next={nextScreening(item, catalogue.meta, { ...state, radarSection: section }, now)}
            rating={rowRating(item, state)}
            href={detailHref("radar", item)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  intro: { paddingHorizontal: space.l, paddingTop: space.l },
  aboutToggle: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.l },
  about: { gap: space.s, paddingHorizontal: space.l },
  note: { paddingHorizontal: space.l, paddingTop: space.m },
});
