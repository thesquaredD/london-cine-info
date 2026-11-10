import type { Film, RatingKey } from "./data";
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
/** The storage key for the List / Posters choice; the website and the app use the same name. */
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
