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

/** The Films list: `sortFilms(filterFilms(selectFilms(films, state)))`. */
export function filmResults(catalogue: Catalogue, state: ViewState, now: Date): Film[] {
  const selected = filterFilms(selectFilms(catalogue.films, state), catalogue.meta, state, now);
  return sortFilms(selected, state.sort, state.direction, undefined, DEFAULT_DISPLAY.titleMode);
}

export function eventResults(catalogue: Catalogue, state: ViewState, now: Date): EventOccurrence[] {
  return matchingEvents(catalogue.events, catalogue.films, catalogue.meta, state, now);
}

export function radarResults(
  catalogue: Catalogue,
  entries: RadarEntry[],
  state: ViewState,
  now: Date,
): Film[] {
  const section = radarSection(state);
  return radarFilms(
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

/** The option counts beside every facet choice, as the website computes them. */
export function optionCounts(
  kind: ScopeKind,
  catalogue: Catalogue,
  state: ViewState,
  now: Date,
): Record<FacetKey, Map<string, number>> {
  if (kind === "events")
    return eventFacetCounts(catalogue.events, catalogue.films, catalogue.meta, state, now);
  return facetCounts(
    selectFilms(catalogue.films, { ...state, filters: {} }),
    catalogue.meta,
    { ...state, radarSection: undefined },
    now,
  );
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
