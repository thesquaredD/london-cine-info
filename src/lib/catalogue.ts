import { normalizeYears, type YearSelection } from "./years";
import { displayTitle, type TitleMode } from "./display";
import { letterboxdSlug } from "../shared/account";
import type { Film, RatingKey, FacetKey } from "../shared/data";

export const PAGE_SIZE = 200;
export const PAGES = [
  { path: "/", name: "All movies" },
  { path: "/new", name: "New releases" },
  { path: "/classics", name: "Classics" },
  { path: "/retrospectives", name: "Retrospectives" },
  { path: "/events", name: "Events" },
  { path: "/calendar", name: "Release calendar" },
  { path: "/watchlist", name: "Watchlist" },
  { path: "/my-calendar", name: "My calendar" },
  { path: "/radar", name: "Radar" },
] as const;
export const RATINGS: { key: RatingKey; name: string; short: string; scale: string }[] = [
  { key: "lb", name: "Letterboxd", short: "LB", scale: "/5" },
  { key: "im", name: "IMDb", short: "IMDb", scale: "/10" },
  { key: "mc", name: "Metacritic", short: "MC", scale: "/100" },
  { key: "rt", name: "Rotten Tomatoes", short: "RT", scale: "%" },
];
export type SortKey =
  "title" | "director" | "year" | "runtime" | "watchlist" | "event" | "opportunity" | RatingKey;
export type ViewState = YearSelection & {
  path: string;
  search: string;
  filters: Partial<Record<FacetKey, string[]>>;
  excluded: Partial<Record<FacetKey, string[]>>;
  from: string;
  to: string;
  available: boolean;
  watchlist?: boolean;
  short?: boolean;
  tonight?: boolean;
  radarSection?: "limited" | "film" | "imax";
  filmGauge?: "35mm" | "70mm";
  eventType?: string;
  director: string;
  /** Explicit default-key sorting still shows its value on mobile. */
  sortExplicit?: true;
  sort: SortKey;
  direction: "asc" | "desc";
  page: number;
};
const sortKeys = [
  "title",
  "director",
  "year",
  "runtime",
  "watchlist",
  "event",
  "opportunity",
  ...RATINGS.map((rating) => rating.key),
];
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function defaultSort(path: string): Pick<ViewState, "sort" | "direction"> {
  return {
    sort: path === "/radar" ? "opportunity" : path === "/calendar" ? "year" : "lb",
    direction: "desc",
  };
}
export function hasCustomSort(state: ViewState): boolean {
  const defaults = defaultSort(state.path);
  return (
    !!state.sortExplicit || state.sort !== defaults.sort || state.direction !== defaults.direction
  );
}
export function nextSort(
  state: ViewState,
  key: SortKey,
): Pick<ViewState, "sort" | "direction" | "sortExplicit"> {
  const first =
    key === "title" || key === "director" || key === "event" || key === "runtime" ? "asc" : "desc";
  if (state.sort !== key) return { sort: key, direction: first, sortExplicit: undefined };
  if (state.direction === first)
    return { sort: key, direction: first === "asc" ? "desc" : "asc", sortExplicit: undefined };
  return { ...defaultSort(state.path), sortExplicit: undefined };
}
export function sortLabel(key: SortKey): string {
  return (
    RATINGS.find((rating) => rating.key === key)?.name ??
    (
      {
        title: "Title",
        director: "Director",
        year: "Year",
        runtime: "Runtime",
        watchlist: "Watchlist",
        event: "Event",
        opportunity: "Radar order",
      } as const
    )[key as "title" | "director" | "year" | "runtime" | "watchlist" | "event" | "opportunity"]
  );
}

function validDateChoice(value: string) {
  if (["today", "tomorrow", "weekend", "week", "this-week", "next-week", "beyond"].includes(value))
    return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function readView(url: URL): ViewState {
  const sort = url.searchParams.get("sort");
  const path = [
    ...PAGES.map((page) => page.path),
    "/about",
    "/privacy",
    "/auth/verify",
    "/unsubscribe",
  ].includes(url.pathname)
    ? url.pathname
    : "/";
  const state: ViewState = {
    path,
    search: url.searchParams.get("q") ?? "",
    filmGauge: ["35mm", "70mm"].includes(url.searchParams.get("filmGauge") ?? "")
      ? (url.searchParams.get("filmGauge") as "35mm" | "70mm")
      : undefined,
    eventType: ["qa", "score", "programme", "talk", "other"].includes(
      url.searchParams.get("eventType") ?? "",
    )
      ? url.searchParams.get("eventType")!
      : "",
    ...normalizeYears({
      decades: url.searchParams
        .getAll("decade")
        .filter((v) => /^\d{4}$/.test(v))
        .map(Number),
      years: url.searchParams
        .getAll("year")
        .filter((v) => /^\d{4}$/.test(v))
        .map(Number),
    }),
    filters: Object.fromEntries(
      [
        "day",
        "time",
        "venue",
        "borough",
        "membership",
        "accessibility",
        "format",
        "genre",
        "language",
      ]
        .map((key) => [
          key,
          [
            ...new Set(
              url.searchParams
                .getAll(key)
                .filter((value) => value && !url.searchParams.getAll(`not_${key}`).includes(value)),
            ),
          ],
        ])
        .filter(([, values]) => values?.length ?? 0),
    ),
    excluded: Object.fromEntries(
      [
        "day",
        "time",
        "venue",
        "borough",
        "membership",
        "accessibility",
        "format",
        "genre",
        "language",
      ]
        .map((key) => [key, [...new Set(url.searchParams.getAll(`not_${key}`).filter(Boolean))]])
        .filter(([, values]) => values?.length ?? 0),
    ),
    from: /^([01]\d|2[0-3]):[0-5]\d$/.test(url.searchParams.get("from") ?? "")
      ? url.searchParams.get("from")!
      : "",
    to: /^([01]\d|2[0-3]):[0-5]\d$/.test(url.searchParams.get("to") ?? "")
      ? url.searchParams.get("to")!
      : "",
    available: url.searchParams.get("available") === "1",
    ...(url.searchParams.get("short") === "1" ? { short: true } : {}),
    ...(url.searchParams.get("tonight") === "1" ? { tonight: true } : {}),
    ...(url.searchParams.get("watchlist") === "1" ? { watchlist: true } : {}),
    director: url.searchParams.get("director") ?? "",
    ...(sort === defaultSort(path).sort && url.searchParams.get("order") !== "asc"
      ? { sortExplicit: true as const }
      : {}),
    sort: sortKeys.includes(sort ?? "") ? (sort as SortKey) : defaultSort(path).sort,
    direction: url.searchParams.get("order") === "asc" ? "asc" : "desc",
    page: Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1),
  };
  if (state.filters.day) state.filters.day = state.filters.day.filter(validDateChoice);
  if (state.excluded.day) state.excluded.day = state.excluded.day.filter(validDateChoice);
  if (state.tonight) {
    state.filters = { ...state.filters, day: ["today"], time: [] };
    state.excluded = { ...state.excluded, day: [], time: [] };
    state.from = "18:00";
    state.to = "";
  }
  return state;
}
export function viewUrl(state: ViewState): string {
  const query = new URLSearchParams();
  if (state.search) query.set("q", state.search);
  if (state.path === "/radar" && state.filmGauge) query.set("filmGauge", state.filmGauge);
  if (state.eventType) query.set("eventType", state.eventType);
  const yearSelection = normalizeYears(state);
  for (const decade of yearSelection.decades) query.append("decade", String(decade));
  for (const year of yearSelection.years) query.append("year", String(year));
  for (const [key, values] of Object.entries(state.filters))
    for (const value of values ?? []) query.append(key, value);
  for (const [key, values] of Object.entries(state.excluded))
    for (const value of values ?? []) query.append(`not_${key}`, value);
  if (state.from) query.set("from", state.from);
  if (state.to) query.set("to", state.to);
  if (state.available) query.set("available", "1");
  if (state.short) query.set("short", "1");
  if (state.tonight) query.set("tonight", "1");
  if (state.watchlist) query.set("watchlist", "1");
  if (state.director) query.set("director", state.director);
  if (state.sortExplicit || state.sort !== defaultSort(state.path).sort)
    query.set("sort", state.sort);
  if (state.direction !== "desc") query.set("order", state.direction);
  if (state.page > 1) query.set("page", String(state.page));
  return `${state.path}${query.size ? `?${query}` : ""}`;
}
export function selectFilms(films: Film[], state: ViewState): Film[] {
  const terms = normalize(state.search.trim()).split(/\s+/).filter(Boolean);
  return films.filter((film) => {
    if (state.path === "/new" && !film.new) return false;
    if (state.path === "/classics" && !film.classic) return false;
    if (state.path === "/retrospectives" && !film.retro.length) return false;
    if (state.path === "/events" && !film.event) return false;
    if (state.path === "/calendar" && !film.upcoming) return false;
    if (state.filters.language?.length && !state.filters.language.includes(film.la)) return false;
    if (state.director && !film.di.some((director) => director.id === state.director)) return false;
    const text = normalize(
      [film.ti, film.o_ti ?? "", ...film.di.map((director) => director.name)].join(" "),
    );
    return terms.every((term) => text.includes(term));
  });
}
function value(
  film: Film,
  key: SortKey,
  watched?: ReadonlySet<string>,
  mode: TitleMode = "both",
): string | number | null {
  if (key === "opportunity") return null;
  if (key === "watchlist") return Number(watched?.has(letterboxdSlug(film.ra.lb?.url) ?? ""));
  if (key === "title") return displayTitle(film, mode);
  if (key === "event") return film.ev?.join(", ") || (film.event ? "Special screening" : null);
  if (key === "director")
    return film.di.length ? film.di.map((director) => director.name).join(", ") : null;
  if (key === "year") return film.ye;
  if (key === "runtime") return film.ru;
  return film.ra[key]?.value ?? null;
}
export function sortFilms(
  films: Film[],
  key: SortKey,
  direction: ViewState["direction"],
  watched?: ReadonlySet<string>,
  mode: TitleMode = "both",
): Film[] {
  return [...films].sort((a, b) => {
    const av = value(a, key, watched, mode),
      bv = value(b, key, watched, mode);
    // Missing values always follow rated/dated films, in either direction.
    if (av === null && bv !== null) return 1;
    if (bv === null && av !== null) return -1;
    const compared =
      av === null || bv === null
        ? 0
        : typeof av === "number" && typeof bv === "number"
          ? av - bv
          : collator.compare(String(av), String(bv));
    return (
      compared * (direction === "asc" ? 1 : -1) ||
      collator.compare(displayTitle(a, mode), displayTitle(b, mode)) ||
      a.id.localeCompare(b.id)
    );
  });
}
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(`${date}T12:00:00Z`));
}
export function runtime(minutes: number | null): string {
  if (minutes === null) return "Runtime unknown";
  return `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h ` : ""}${minutes % 60}m`;
}

export type TableRow = {
  film: Film;
  group: { id: string; name: string; count: number } | null;
  key: string;
};
export function tableRows(films: Film[], state: ViewState): TableRow[] {
  if (state.path === "/calendar") {
    const groups = new Map<string, Film[]>();
    for (const film of films) {
      const date = film.rd || "later";
      groups.set(date, [...(groups.get(date) ?? []), film]);
    }
    return [...groups]
      .sort(([a], [b]) => (a === "later" ? 1 : b === "later" ? -1 : a.localeCompare(b)))
      .flatMap(([date, entries]) =>
        entries.map((film) => ({
          film,
          key: film.id,
          group: {
            id: `release-${date}`,
            name:
              date === "later"
                ? "Released later · date unknown"
                : `Released on ${formatDate(date)}`,
            count: entries.length,
          },
        })),
      );
  }
  if (state.path !== "/retrospectives")
    return films.map((film) => ({ film, group: null, key: film.id }));
  const groups = new Map<string, { name: string; films: Film[] }>();
  for (const film of films) {
    for (const director of film.di.filter(
      (director) =>
        film.retro.includes(director.id) && (!state.director || director.id === state.director),
    )) {
      const group = groups.get(director.id) ?? { name: director.name, films: [] };
      group.films.push(film);
      groups.set(director.id, group);
    }
  }
  return [...groups]
    .sort(
      (a, b) =>
        collator.compare(a[1].name, b[1].name) *
        (state.sort === "director" && state.direction === "desc" ? -1 : 1),
    )
    .flatMap(([id, group]) =>
      group.films.map((film) => ({
        film,
        group: { id, name: group.name, count: group.films.length },
        key: `${id}:${film.id}`,
      })),
    );
}
