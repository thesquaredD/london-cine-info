import type { Film, RatingKey } from "../shared/data";

export const PAGE_SIZE = 200;
export const PAGES = [
  { path: "/", name: "All movies" },
  { path: "/new", name: "New releases" },
  { path: "/classics", name: "Classics" },
  { path: "/retrospectives", name: "Retrospectives" },
  { path: "/events", name: "Events" },
  { path: "/calendar", name: "Calendar" },
] as const;
export const RATINGS: { key: RatingKey; name: string; short: string; scale: string }[] = [
  { key: "lb", name: "Letterboxd", short: "LB", scale: "/5" },
  { key: "im", name: "IMDb", short: "IMDb", scale: "/10" },
  { key: "mc", name: "Metacritic", short: "MC", scale: "/100" },
  { key: "rt", name: "Rotten Tomatoes", short: "RT", scale: "%" },
];
export type SortKey = "title" | "director" | "year" | RatingKey;
export type ViewState = {
  path: string;
  search: string;
  language: string;
  director: string;
  sort: SortKey;
  direction: "asc" | "desc";
  page: number;
};
const sortKeys = ["title", "director", "year", ...RATINGS.map((rating) => rating.key)];
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function readView(url: URL): ViewState {
  const sort = url.searchParams.get("sort");
  const path = [...PAGES.map((page) => page.path), "/about"].includes(url.pathname)
    ? url.pathname
    : "/";
  return {
    path,
    search: url.searchParams.get("q") ?? "",
    language: url.searchParams.get("language") ?? "",
    director: url.searchParams.get("director") ?? "",
    sort: sortKeys.includes(sort ?? "") ? (sort as SortKey) : path === "/calendar" ? "year" : "lb",
    direction: url.searchParams.get("order") === "asc" ? "asc" : "desc",
    page: Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1),
  };
}
export function viewUrl(state: ViewState): string {
  const query = new URLSearchParams();
  if (state.search) query.set("q", state.search);
  if (state.language) query.set("language", state.language);
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
    if (state.language && film.la !== state.language) return false;
    if (state.director && !film.di.some((director) => director.id === state.director)) return false;
    const text = normalize(
      [film.ti, film.o_ti ?? "", ...film.di.map((director) => director.name)].join(" "),
    );
    return terms.every((term) => text.includes(term));
  });
}
function value(film: Film, key: SortKey): string | number | null {
  if (key === "title") return film.ti;
  if (key === "director")
    return film.di.length ? film.di.map((director) => director.name).join(", ") : null;
  if (key === "year") return film.ye;
  return film.ra[key]?.value ?? null;
}
export function sortFilms(films: Film[], key: SortKey, direction: ViewState["direction"]): Film[] {
  return [...films].sort((a, b) => {
    const av = value(a, key),
      bv = value(b, key);
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
