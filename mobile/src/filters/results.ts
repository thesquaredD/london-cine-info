import { selectFilms, sortFilms, type ViewState } from "@readograph/core/catalogue";
import type { Catalogue } from "@readograph/core/catalogue-loader";
import type { EventOccurrence, FacetKey, Film } from "@readograph/core/data";
import { DEFAULT_DISPLAY } from "@readograph/core/display";
import { eventFacetCounts, matchingEvents } from "@readograph/core/event-view";
import { facetCounts, filterFilms } from "@readograph/core/filters";
import { radarEntries, radarFilms, type RadarEntry } from "@readograph/core/radar";
import { catalogueDecades, countYears } from "@readograph/core/years";

/**
 * What each list tab shows for a `ViewState`, and the counts its Filters sheet prints, computed
 * the way the website's app.tsx computes them. The list screen and its Filters sheet both call
 * these, so the sheet's heading and Show button always state the list's live count.
 */
export type ScopeKind = "films" | "events" | "radar";

export type RadarSection = NonNullable<ViewState["radarSection"]>;

/** The Radar tab's open section; stored in the Radar store's `radarSection`. */
export function radarSection(state: ViewState): RadarSection {
  return state.radarSection ?? "limited";
}

/**
 * The last list each tab computed, so the Filters sheet's count reuses the list's work instead
 * of filtering the whole catalogue a second time (about 300 ms for the Films tab in a release
 * build on the emulator). A remembered list counts when the catalogue and the `ViewState` are
 * the same objects and it is less than a minute old, the interval at which the list itself
 * moves on (`useNow`).
 */
type Remembered<T> = { catalogue: Catalogue; state: ViewState; time: number; value: T };
const remembered: {
  films?: Remembered<Film[]>;
  events?: Remembered<EventOccurrence[]>;
  radar?: Remembered<Film[]>;
} = {};
const FRESH_MS = 60_000;

function recall<T>(
  entry: Remembered<T> | undefined,
  catalogue: Catalogue,
  state: ViewState,
  now: Date,
): T | undefined {
  return entry &&
    entry.catalogue === catalogue &&
    entry.state === state &&
    Math.abs(now.getTime() - entry.time) < FRESH_MS
    ? entry.value
    : undefined;
}

/** The Films list: `sortFilms(filterFilms(selectFilms(films, state)))`. */
export function filmResults(catalogue: Catalogue, state: ViewState, now: Date): Film[] {
  const selected = filterFilms(selectFilms(catalogue.films, state), catalogue.meta, state, now);
  const value = sortFilms(
    selected,
    state.sort,
    state.direction,
    undefined,
    DEFAULT_DISPLAY.titleMode,
  );
  remembered.films = { catalogue, state, time: now.getTime(), value };
  return value;
}

export function eventResults(catalogue: Catalogue, state: ViewState, now: Date): EventOccurrence[] {
  const value = matchingEvents(catalogue.events, catalogue.films, catalogue.meta, state, now);
  remembered.events = { catalogue, state, time: now.getTime(), value };
  return value;
}

export function radarResults(
  catalogue: Catalogue,
  entries: RadarEntry[],
  state: ViewState,
  now: Date,
): Film[] {
  const section = radarSection(state);
  const value = radarFilms(
    entries,
    catalogue.meta,
    {
      ...state,
      radarSection: section,
      filmGauge: section === "film" ? state.filmGauge : undefined,
    },
    section,
    now,
    undefined,
    DEFAULT_DISPLAY.titleMode,
  );
  remembered.radar = { catalogue, state, time: now.getTime(), value };
  return value;
}

/** Radar's per-film screening lists, computed once per catalogue and minute. */
export function radarIndex(catalogue: Catalogue, now: Date): RadarEntry[] {
  return radarEntries(catalogue.films, catalogue.meta, now);
}

/** The number the sheet's heading and the Show button state. */
export function resultCount(
  kind: ScopeKind,
  catalogue: Catalogue,
  state: ViewState,
  now: Date,
): number {
  const known = recall<readonly unknown[]>(remembered[kind], catalogue, state, now);
  if (known) return known.length;
  if (kind === "events") return eventResults(catalogue, state, now).length;
  if (kind === "radar")
    return radarResults(catalogue, radarIndex(catalogue, now), state, now).length;
  return filmResults(catalogue, state, now).length;
}

/** "44 films", "1 event". */
export function resultLabel(kind: ScopeKind, count: number): string {
  const noun = kind === "events" ? "event" : "film";
  return `${count.toLocaleString("en-GB")} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * The option counts beside one facet's choices, as the website computes them. One facet at a
 * time: all nine together take about 2.6 seconds in a release build on the emulator, and the
 * sheet only shows the counts of a facet the reader has opened.
 */
export function optionCounts(
  kind: ScopeKind,
  catalogue: Catalogue,
  state: ViewState,
  now: Date,
  facet: FacetKey,
): Map<string, number> {
  if (kind === "events")
    return eventFacetCounts(catalogue.events, catalogue.films, catalogue.meta, state, now, [facet])[
      facet
    ];
  return facetCounts(
    selectFilms(catalogue.films, { ...state, filters: {} }),
    catalogue.meta,
    { ...state, radarSection: undefined },
    now,
    [facet],
  )[facet];
}

/** The decades offered in the Year row, with how many films each would show. */
export function decadeCounts(
  kind: ScopeKind,
  catalogue: Catalogue,
  state: ViewState,
  now: Date,
): { decade: number; count: number }[] {
  const withoutYears = { ...state, decades: [], years: [], radarSection: undefined };
  const films =
    kind === "events"
      ? (() => {
          const ids = new Set(
            matchingEvents(
              catalogue.events,
              catalogue.films,
              catalogue.meta,
              withoutYears,
              now,
            ).map((event) => event.filmId),
          );
          return catalogue.films.filter((film) => ids.has(film.id));
        })()
      : filterFilms(selectFilms(catalogue.films, withoutYears), catalogue.meta, withoutYears, now);
  const years = countYears(films);
  return catalogueDecades(catalogue.films).map((decade) => {
    let count = 0;
    for (let year = decade; year < decade + 10; year++) count += years.get(year) ?? 0;
    return { decade, count };
  });
}
