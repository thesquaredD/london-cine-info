import type { DataMeta, EventOccurrence, Film, FacetKey } from "../shared/data";
import type { ViewState } from "./catalogue";
import { selectFilms } from "./catalogue";
import { FILTERS, dayMatches, londonDate, filterFilms, screeningMatcher } from "./filters";
export function matchingEvents(
  events: EventOccurrence[],
  films: Film[],
  meta: DataMeta,
  state: ViewState,
  now = new Date(),
) {
  const eligible = new Set(
    filterFilms(selectFilms(films, state), meta, state, now).map((film) => film.id),
  );
  const allIds = new Set(films.map((film) => film.id));
  const matcher = screeningMatcher(meta, { ...state, eventType: "" }, now);
  return events
    .filter(
      (event) =>
        (eligible.has(event.filmId) ||
          (!allIds.has(event.filmId) &&
            !state.watchlist &&
            !state.short &&
            !state.director &&
            !state.filters.genre?.length &&
            !state.filters.language?.length &&
            !state.excluded.genre?.length &&
            !state.excluded.language?.length &&
            event.title.toLowerCase().includes(state.search.trim().toLowerCase()))) &&
        (!state.eventType || event.types.includes(state.eventType)) &&
        matcher.showtime(event.date, event),
    )
    .sort((a, b) => a.time - b.time || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}
export function groupEvents(events: EventOccurrence[]) {
  const groups = new Map<string, EventOccurrence[]>();
  for (const event of events) {
    const rows = groups.get(event.date) ?? [];
    rows.push(event);
    groups.set(event.date, rows);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b));
}

// Events picker counts describe occurrences, rather than distinct film titles.
export function eventFacetCounts(
  events: EventOccurrence[],
  films: Film[],
  meta: DataMeta,
  state: ViewState,
  now = new Date(),
): Record<FacetKey, Map<string, number>> {
  const result = {} as Record<FacetKey, Map<string, number>>;
  const byId = new Map(films.map((film) => [film.id, film]));
  const venues = new Map(meta.venues.map((venue) => [venue.id, venue]));
  for (const { key } of FILTERS) {
    const without = {
      ...state,
      filters: { ...state.filters, [key]: [] },
      excluded: { ...state.excluded, [key]: [] },
      ...(state.tonight && (key === "day" || key === "time")
        ? { tonight: false, from: "", to: "" }
        : {}),
    };
    const counts = new Map<string, number>();
    for (const row of matchingEvents(events, films, meta, without, now)) {
      const film = byId.get(row.filmId),
        venue = venues.get(row.venue);
      const minute = Number(row.localTime.slice(0, 2)) * 60 + Number(row.localTime.slice(3));
      const values: Record<FacetKey, string[]> = {
        day: [
          row.date,
          ...["today", "tomorrow", "week", "this-week", "next-week", "weekend", "beyond"].filter(
            (id) => dayMatches(row.date, [id], londonDate(now)),
          ),
        ],
        time: [minute < 720 ? "morning" : minute < 1020 ? "afternoon" : "evening"],
        venue: [row.venue],
        borough: venue ? [venue.borough] : [],
        membership: venue?.memberships ?? [],
        format: row.formats,
        accessibility: row.accessibility,
        genre: film?.ge ?? [],
        language: film ? [film.la] : [],
      };
      for (const id of new Set(values[key])) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    result[key] = counts;
  }
  return result;
}
