import { yearMatches } from "./years";
import { isEventScreening, eventTypes } from "../data/event-rules";
import type { DataMeta, FacetKey, Film, Showtime, Venue } from "../shared/data";
import { defaultSort, type ViewState } from "./catalogue";
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
  myCinemas: false,
  film: undefined,
  sortExplicit: undefined,
  eventType: "",
  filmGauge: undefined,
  decades: [],
  years: [],
  watchlist: false,
  short: false,
  tonight: false,
  search: "",
  director: "",
  filters: {},
  excluded: {},
  from: "",
  to: "",
  available: false,
  page: 1,
};
export function clearFilters(path: string) {
  return { ...CLEAR_FILTERS, ...defaultSort(path) };
}
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
      if (id === "this-week" || id === "next-week") {
        const start = addDays(today, id === "this-week" ? 0 : 7);
        const end = addDays(today, id === "this-week" ? 6 : 13);
        return date >= start && date <= end;
      }
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
export type ScreeningView = {
  epoch: number | null;
  screen: string | null;
  date: string;
  minute: number;
  venue: Venue | undefined;
  formats: string[];
  accessibility: string[];
  soldOut: boolean;
  event: boolean;
  eventTypes?: string[];
};
const screeningCache = new WeakMap<
  DataMeta,
  { venues: Map<string, Venue>; films: WeakMap<Film, ScreeningView[]> }
>();
export function decodedScreenings(film: Film, meta: DataMeta): ScreeningView[] {
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
  const rows = film.sc.map(
    ([day, minute, venue, format, access, soldOut, event, epoch, screen, eventTypes]) => ({
      epoch:
        epoch === undefined
          ? null
          : meta.screeningEpoch === undefined
            ? epoch
            : Math.round(meta.screeningEpoch + epoch * 60000),
      screen: typeof screen === "number" ? (meta.screens?.[screen] ?? null) : (screen ?? null),
      date: meta.facets.day[day]?.id ?? "",
      minute,
      venue: cache.venues.get(meta.facets.venue[venue]?.id ?? ""),
      formats: meta.facets.format.filter((_, i) => Boolean(format & (2 ** i))).map((o) => o.id),
      accessibility: meta.facets.accessibility
        .filter((_, i) => Boolean(access & (2 ** i)))
        .map((o) => o.id),
      soldOut: Boolean(soldOut),
      eventTypes,
      event: event === undefined ? film.event : Boolean(event),
    }),
  );
  cache.films.set(film, rows);
  return rows;
}
export function upcomingScreenings(film: Film, meta: DataMeta, now: Date): ScreeningView[] {
  const rows = new Map<string, ScreeningView>();
  for (const row of decodedScreenings(film, meta)) {
    if (row.epoch === null || row.epoch <= now.getTime()) continue;
    const key = JSON.stringify([row.epoch, row.venue?.id, row.screen]);
    const previous = rows.get(key);
    if (previous) previous.formats = [...new Set([...previous.formats, ...row.formats])];
    else rows.set(key, { ...row, formats: [...row.formats] });
  }
  return [...rows.values()].sort((a, b) => a.epoch! - b.epoch!);
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
    epoch: number | null,
  ) {
    if (state.path === "/radar" && (epoch === null || epoch <= now.getTime())) return false;
    if (state.radarSection === "film" && !isFilmFormat(formats, state.filmGauge)) return false;
    if (state.radarSection === "imax" && !isImaxFormat(formats)) return false;
    if (
      state.tonight &&
      (date !== today || minute < 1080 || epoch === null || epoch <= now.getTime())
    )
      return false;
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
  const opportunities = new WeakMap<Film, boolean>();
  function radarRow(row: ScreeningView, film?: Film) {
    if (state.path !== "/radar" || state.radarSection) return true;
    if (!film) return false;
    let limited = opportunities.get(film);
    if (limited === undefined) {
      const upcoming = upcomingScreenings(film, meta, now);
      const count = upcoming.length;
      limited =
        count >= 1 &&
        count <= 3 &&
        upcoming.some(
          (screening) => screening.date <= addDays(londonDate(now), 6) && !screening.soldOut,
        );
      opportunities.set(film, limited);
    }
    return limited || isSpecialFormat(row.formats);
  }
  const eventMatches = (types: string[] = []) =>
    !state.eventType ||
    (state.eventType === "highlights"
      ? types.some((type) => ["qa", "score", "talk"].includes(type))
      : types.includes(state.eventType));
  return {
    row: (row: ScreeningView, film?: Film) =>
      radarRow(row, film) &&
      (state.path !== "/events" || (row.event && eventMatches(row.eventTypes))) &&
      match(
        row.date,
        row.minute,
        row.venue?.id ?? "",
        row.formats,
        row.accessibility,
        row.soldOut,
        row.epoch,
      ),
    film: (film: Film) =>
      (!state.short || (film.ru !== null && film.ru < 120)) &&
      yearMatches(film.ye, state) &&
      accepts(state, "genre", film.ge) &&
      accepts(state, "language", [film.la]) &&
      decodedScreenings(film, meta).some(
        (row) =>
          radarRow(row, film) &&
          (state.path !== "/events" || (row.event && eventMatches(row.eventTypes))) &&
          match(
            row.date,
            row.minute,
            row.venue?.id ?? "",
            row.formats,
            row.accessibility,
            row.soldOut,
            row.epoch,
          ),
      ),
    showtime: (date: string, row: Showtime) =>
      (state.path !== "/events" ||
        (isEventScreening(row.category, row.notes, row.eventTitle) &&
          eventMatches(eventTypes(row.category, row.notes, row.eventTitle)))) &&
      match(
        date,
        minuteOf(row.localTime),
        row.venue,
        row.formats,
        row.accessibility,
        row.soldOut,
        row.time,
      ),
  };
}
export function hasScreeningFilters(state: ViewState) {
  return Boolean(
    state.path === "/events" ||
    state.path === "/radar" ||
    state.tonight ||
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
    if (state.short && (film.ru === null || film.ru >= 120)) return false;
    if (!yearMatches(film.ye, state)) return false;
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
      ["today", "tomorrow", "week", "this-week", "next-week", "weekend", "beyond"].filter((id) =>
        dayMatches(option.id, [id], today),
      ),
    ]),
  );
  for (const { key } of FILTERS) {
    const without = {
      ...state,
      filters: { ...state.filters, [key]: [] },
      excluded: { ...state.excluded, [key]: [] },
      ...(state.tonight && (key === "day" || key === "time")
        ? { tonight: false, from: "", to: "" }
        : {}),
    };
    const matcher = screeningMatcher(meta, without, now);
    const counts = new Map<string, number>();
    for (const film of films) {
      if (state.short && (film.ru === null || film.ru >= 120)) continue;
      if (!yearMatches(film.ye, state)) continue;
      if (!accepts(without, "genre", film.ge) || !accepts(without, "language", [film.la])) continue;
      const ids = new Set<string>();
      if (key === "genre" || key === "language") {
        if (hasScreeningFilters(without) && !matcher.film(film)) continue;
        (key === "genre" ? film.ge : [film.la]).forEach((id) => ids.add(id));
      } else
        for (const row of decodedScreenings(film, meta)) {
          if (!matcher.row(row, film)) continue;
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
const filterDateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});
export function filterLabel(key: FacetKey, id: string, meta: DataMeta): string {
  if (key === "day") {
    const quick: Record<string, string> = {
      today: "Today",
      tomorrow: "Tomorrow",
      week: "Next 7 days",
      "this-week": "This week",
      "next-week": "Next week",
      weekend: "This weekend",
      beyond: "Later",
    };
    if (quick[id]) return quick[id];
    if (/^\d{4}-\d{2}-\d{2}$/.test(id))
      return filterDateFormatter.format(new Date(`${id}T12:00:00Z`));
  }
  return meta.facets[key].find((option) => option.id === id)?.label ?? id;
}

export function isSpecialFormat(formats: string[]) {
  return isFilmFormat(formats) || isImaxFormat(formats);
}
export function isFilmFormat(formats: string[], gauge?: "35mm" | "70mm") {
  return formats.some((format) => {
    const value = format.toLowerCase();
    return (!gauge || value.includes(gauge)) && /\b(?:35|70)mm\b/.test(value);
  });
}
export function isImaxFormat(formats: string[]) {
  return formats.some((format) => /\bimax\b/i.test(format));
}
export const DATE_SHORTCUTS = [
  "today",
  "tomorrow",
  "weekend",
  "this-week",
  "next-week",
  "week",
  "beyond",
];
export function dateShortcut(state: ViewState, id: string): Partial<ViewState> {
  const active =
    id === "tonight"
      ? state.tonight
      : !state.tonight &&
        state.filters.day?.length === 1 &&
        state.filters.day[0] === id &&
        !state.excluded.day?.length;
  return {
    filters: {
      ...state.filters,
      day: active ? [] : [id === "tonight" ? "today" : id],
      ...(state.tonight || id === "tonight" ? { time: [] } : {}),
    },
    excluded: {
      ...state.excluded,
      day: [],
      ...(state.tonight || id === "tonight" ? { time: [] } : {}),
    },
    tonight: id === "tonight" && !active,
    ...(state.tonight || id === "tonight"
      ? { from: id === "tonight" && !active ? "18:00" : "", to: "" }
      : {}),
    page: 1,
  };
}

export function isEvening(state: ViewState): boolean {
  return (
    !state.tonight &&
    !state.from &&
    !state.to &&
    state.filters.time?.length === 1 &&
    state.filters.time[0] === "evening" &&
    !state.excluded.time?.length
  );
}
export function eveningShortcut(state: ViewState): Partial<ViewState> {
  return {
    filters: { ...state.filters, time: isEvening(state) ? [] : ["evening"] },
    excluded: { ...state.excluded, time: [] },
    from: "",
    to: "",
    tonight: false,
    page: 1,
  };
}
