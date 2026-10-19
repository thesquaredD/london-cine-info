import type { Film, RatingKey } from "../shared/data";
export type TitleMode = "both" | "title" | "original";
export type DisplayState = {
  titleMode: TitleMode;
  hideWatchlistRatings?: boolean;
  ratingOrder: RatingKey[];
};
export const DEFAULT_DISPLAY: DisplayState = {
  titleMode: "both",
  hideWatchlistRatings: false,
  ratingOrder: ["lb", "im", "mc", "rt"],
};
export function displayTitle(film: Film, mode: TitleMode): string {
  return mode === "original" ? film.o_ti || film.ti : film.ti;
}
export function moveRating(
  order: RatingKey[],
  source: RatingKey,
  destination: number,
): RatingKey[] {
  const result = order.filter((key) => key !== source);
  result.splice(Math.max(0, Math.min(result.length, destination)), 0, source);
  return result;
}

export const HIDE_RATINGS_STORAGE = "london-cine.hide-watchlist-ratings.v1";
export function readHideRatings(): boolean {
  try {
    return localStorage.getItem(HIDE_RATINGS_STORAGE) === "true";
  } catch {
    return false;
  }
}
export function watchlistDisplay(
  display: DisplayState,
  state: { path: string; watchlist?: boolean },
): DisplayState {
  return display.hideWatchlistRatings && (state.path === "/watchlist" || state.watchlist)
    ? { ...display, ratingOrder: [] }
    : display;
}

/** List or poster browsing for film results. Events and Radar keep their own layouts. */
export type FilmView = "list" | "posters";
export const FILM_VIEW_STORAGE = "london-cine.film-view.v1";
export const POSTER_VIEW_PATHS = [
  "/",
  "/new",
  "/classics",
  "/retrospectives",
  "/calendar",
  "/watchlist",
];
export function supportsPosters(path: string): boolean {
  return POSTER_VIEW_PATHS.includes(path);
}
export function readFilmView(storage: Pick<Storage, "getItem"> | null = safeStorage()): FilmView {
  try {
    return storage?.getItem(FILM_VIEW_STORAGE) === "posters" ? "posters" : "list";
  } catch {
    return "list";
  }
}
/** Returns false when the choice could not be remembered beyond this visit. */
export function saveFilmView(
  view: FilmView,
  storage: Pick<Storage, "setItem"> | null = safeStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(FILM_VIEW_STORAGE, view);
    return true;
  } catch {
    return false;
  }
}
function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
