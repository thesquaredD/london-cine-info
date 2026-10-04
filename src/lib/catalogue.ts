import { letterboxdSlug } from "../shared/account";
import type { Film, RatingKey, FacetKey } from "../shared/data";

export const PAGE_SIZE = 200;
export const PAGES = [
  { path: "/", name: "All movies" },
  { path: "/new", name: "New releases" },
  { path: "/classics", name: "Classics" },
  { path: "/retrospectives", name: "Retrospectives" },
  { path: "/events", name: "Events" },
  { path: "/calendar", name: "Calendar" },
  { path: "/watchlist", name: "Watchlist" },
] as const;
export const RATINGS: { key: RatingKey; name: string; short: string; scale: string }[] = [
  { key: "lb", name: "Letterboxd", short: "LB", scale: "/5" },
  { key: "im", name: "IMDb", short: "IMDb", scale: "/10" },
  { key: "mc", name: "Metacritic", short: "MC", scale: "/100" },
  { key: "rt", name: "Rotten Tomatoes", short: "RT", scale: "%" },
];
export type SortKey = "title" | "director" | "year" | "watchlist" | RatingKey;
export type ViewState = {
  path: string;
  search: string;
  filters: Partial<Record<FacetKey, string[]>>;
  excluded: Partial<Record<FacetKey, string[]>>;
  from: string;
  to: string;
  available: boolean;
  watchlist?: boolean;
  director: string;
  sort: SortKey;
  direction: "asc" | "desc";
  page: number;
};
const sortKeys = ["title", "director", "year", "watchlist", ...RATINGS.map((rating) => rating.key)];
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

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
  return {
    path,
    search: url.searchParams.get("q") ?? "",
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
    ...(url.searchParams.get("watchlist") === "1" ? { watchlist: true } : {}),
    director: url.searchParams.get("director") ?? "",
    sort: sortKeys.includes(sort ?? "") ? (sort as SortKey) : path === "/calendar" ? "year" : "lb",
    direction: url.searchParams.get("order") === "asc" ? "asc" : "desc",
    page: Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1),
  };
}
export function viewUrl(state: ViewState): string {
  const query = new URLSearchParams();
  if (state.search) query.set("q", state.search);
  for (const [key, values] of Object.entries(state.filters))
    for (const value of values ?? []) query.append(key, value);
  for (const [key, values] of Object.entries(state.excluded))
    for (const value of values ?? []) query.append(`not_${key}`, value);
  if (state.from) query.set("from", state.from);
  if (state.to) query.set("to", state.to);
  if (state.available) query.set("available", "1");
  if (state.watchlist) query.set("watchlist", "1");
  if (state.director) query.set("director", state.director);
  if (state.sort !== (state.path === "/calendar" ? "year" : "lb")) query.set("sort", state.sort);
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
function value(film: Film, key: SortKey, watched?: ReadonlySet<string>): string | number | null {
  if (key === "watchlist") return Number(watched?.has(letterboxdSlug(film.ra.lb?.url) ?? ""));
  if (key === "title") return film.ti;
  if (key === "director")
    return film.di.length ? film.di.map((director) => director.name).join(", ") : null;
  if (key === "year") return film.ye;
  return film.ra[key]?.value ?? null;
}
export function sortFilms(
  films: Film[],
  key: SortKey,
  direction: ViewState["direction"],
  watched?: ReadonlySet<string>,
): Film[] {
  return [...films].sort((a, b) => {
    const av = value(a, key, watched),
      bv = value(b, key, watched);
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
      collator.compare(a.ti, b.ti) ||
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
