import type { DataMeta, FacetKey, Film, Showtime, Venue } from "../shared/data";
import type { ViewState } from "./catalogue";
export const FILTERS: { key: FacetKey; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "time", label: "Time" },
  { key: "venue", label: "Cinema" },
  { key: "borough", label: "Borough" },
  { key: "membership", label: "Membership" },
  { key: "accessibility", label: "Accessibility" },
  { key: "format", label: "Format" },
  { key: "genre", label: "Genre" },
  { key: "language", label: "Original language" },
];
export const CLEAR_FILTERS = {
  search: "",
  director: "",
  filters: {},
  excluded: {},
  from: "",
  to: "",
  available: false,
  page: 1,
};
export function londonDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function dayMatches(date: string, selected: string[], today: string): boolean {
  return (
    !selected.length ||
    selected.some((id) => {
      if (id === "today") return date === today;
      if (id === "tomorrow") return date === addDays(today, 1);
      if (id === "week") return date >= today && date <= addDays(today, 6);
      if (id === "weekend") {
        const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
        const start = weekday === 0 ? today : addDays(today, (6 - weekday + 7) % 7);
        return date === start || (weekday !== 0 && date === addDays(start, 1));
      }
      if (id === "beyond") return date > addDays(today, 6);
      return date === id;
    })
  );
}
const minuteOf = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const any = (selected: string[], values: string[]) =>
  !selected.length || selected.some((id) => values.includes(id));
const accepts = (state: ViewState, key: FacetKey, values: string[]) =>
  any(state.filters[key] ?? [], values) &&
  !(state.excluded[key] ?? []).some((id) => values.includes(id));
type ScreeningView = {
  date: string;
  minute: number;
  venue: Venue | undefined;
  formats: string[];
  accessibility: string[];
  soldOut: boolean;
};
const screeningCache = new WeakMap<
  DataMeta,
  { venues: Map<string, Venue>; films: WeakMap<Film, ScreeningView[]> }
>();
function decodedScreenings(film: Film, meta: DataMeta): ScreeningView[] {
  let cache = screeningCache.get(meta);
  if (!cache) {
    cache = {
      venues: new Map(meta.venues.map((venue) => [venue.id, venue])),
      films: new WeakMap(),
    };
    screeningCache.set(meta, cache);
  }
  const existing = cache.films.get(film);
  if (existing) return existing;
  const rows = film.sc.map(([day, minute, venue, format, access, soldOut]) => ({
    date: meta.facets.day[day]?.id ?? "",
    minute,
    venue: cache.venues.get(meta.facets.venue[venue]?.id ?? ""),
    formats: meta.facets.format.filter((_, i) => Boolean(format & (2 ** i))).map((o) => o.id),
    accessibility: meta.facets.accessibility
      .filter((_, i) => Boolean(access & (2 ** i)))
      .map((o) => o.id),
    soldOut: Boolean(soldOut),
  }));
  cache.films.set(film, rows);
  return rows;
}
export function screeningMatcher(meta: DataMeta, state: ViewState, now = new Date()) {
  const today = londonDate(now),
    picks = state.filters;
  const venues = new Map(meta.venues.map((venue) => [venue.id, venue]));
  const allowedDays = picks.day?.length
    ? new Set(
        meta.facets.day
          .filter((option) => dayMatches(option.id, picks.day!, today))
          .map((option) => option.id),
      )
    : null;
  const forbiddenDays = new Set(
    meta.facets.day
      .filter(
        (option) => state.excluded.day?.length && dayMatches(option.id, state.excluded.day, today),
      )
      .map((option) => option.id),
  );
  function match(
    date: string,
    minute: number,
    venueId: string,
    formats: string[],
    accessibility: string[],
    soldOut: boolean,
  ) {
    const venue = venues.get(venueId);
    if ((allowedDays && !allowedDays.has(date)) || forbiddenDays.has(date)) return false;
    if (
      !accepts(state, "time", [minute < 720 ? "morning" : minute < 1020 ? "afternoon" : "evening"])
    )
      return false;
    if (state.from && state.to && state.from > state.to) {
      if (minute < minuteOf(state.from) && minute > minuteOf(state.to)) return false;
    } else if (
      (state.from && minute < minuteOf(state.from)) ||
      (state.to && minute > minuteOf(state.to))
    )
      return false;
    return (
      accepts(state, "venue", [venueId]) &&
      accepts(state, "borough", venue ? [venue.borough] : []) &&
      accepts(state, "membership", venue?.memberships ?? []) &&
      accepts(state, "format", formats) &&
      accepts(state, "accessibility", accessibility) &&
      (!state.available || !soldOut)
    );
  }
  return {
    row: (row: ScreeningView) =>
      match(row.date, row.minute, row.venue?.id ?? "", row.formats, row.accessibility, row.soldOut),
    film: (film: Film) =>
      accepts(state, "genre", film.ge) &&
      accepts(state, "language", [film.la]) &&
      decodedScreenings(film, meta).some((row) =>
        match(
          row.date,
          row.minute,
          row.venue?.id ?? "",
          row.formats,
          row.accessibility,
          row.soldOut,
        ),
      ),
    showtime: (date: string, row: Showtime) =>
      match(date, minuteOf(row.localTime), row.venue, row.formats, row.accessibility, row.soldOut),
  };
}
export function hasScreeningFilters(state: ViewState) {
  return Boolean(
    state.available ||
    state.from ||
    state.to ||
    FILTERS.some(
      ({ key }) =>
        key !== "genre" &&
        key !== "language" &&
        (state.filters[key]?.length || state.excluded[key]?.length),
    ),
  );
}
export function filterFilms(films: Film[], meta: DataMeta, state: ViewState, now = new Date()) {
  const matcher = screeningMatcher(meta, state, now);
  return films.filter((film) => {
    if (!accepts(state, "genre", film.ge) || !accepts(state, "language", [film.la])) return false;
    return !hasScreeningFilters(state) || matcher.film(film);
  });
}
export function facetCounts(
  films: Film[],
  meta: DataMeta,
  state: ViewState,
  now = new Date(),
): Record<FacetKey, Map<string, number>> {
  const result = {} as Record<FacetKey, Map<string, number>>;
  const today = londonDate(now);
  const quickDays = new Map(
    meta.facets.day.map((option) => [
      option.id,
      ["today", "tomorrow", "week", "weekend", "beyond"].filter((id) =>
        dayMatches(option.id, [id], today),
      ),
    ]),
  );
  for (const { key } of FILTERS) {
    const without = {
      ...state,
      filters: { ...state.filters, [key]: [] },
      excluded: { ...state.excluded, [key]: [] },
    };
    const matcher = screeningMatcher(meta, without, now);
    const counts = new Map<string, number>();
    for (const film of films) {
      if (!accepts(without, "genre", film.ge) || !accepts(without, "language", [film.la])) continue;
      const ids = new Set<string>();
      if (key === "genre" || key === "language") {
        if (hasScreeningFilters(without) && !matcher.film(film)) continue;
        (key === "genre" ? film.ge : [film.la]).forEach((id) => ids.add(id));
      } else
        for (const row of decodedScreenings(film, meta)) {
          if (!matcher.row(row)) continue;
          const { date, minute, venue, formats, accessibility: access } = row;
          if (key === "day") {
            ids.add(date);
            quickDays.get(date)?.forEach((id) => ids.add(id));
          }
          if (key === "time")
            ids.add(minute < 720 ? "morning" : minute < 1020 ? "afternoon" : "evening");
          if (key === "venue" && venue) ids.add(venue.id);
          if (key === "borough" && venue) ids.add(venue.borough);
          if (key === "membership") venue?.memberships.forEach((id) => ids.add(id));
          if (key === "format") formats.forEach((id) => ids.add(id));
          if (key === "accessibility") access.forEach((id) => ids.add(id));
        }
      ids.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    }
    result[key] = counts;
  }
  return result;
}
export function filterLabel(key: FacetKey, id: string, meta: DataMeta): string {
  if (key === "day") {
    const quick: Record<string, string> = {
      today: "Today",
      tomorrow: "Tomorrow",
      week: "Next 7 days",
      weekend: "This weekend",
      beyond: "Later",
    };
    if (quick[id]) return quick[id];
    if (/^\d{4}-\d{2}-\d{2}$/.test(id))
      return new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Europe/London",
      }).format(new Date(`${id}T12:00:00Z`));
  }
  return meta.facets[key].find((option) => option.id === id)?.label ?? id;
}
