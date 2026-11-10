import { FILM_VIEW_STORAGE, type FilmView } from "@readograph/core/display";
export * from "@readograph/core/display";

export const HIDE_RATINGS_STORAGE = "london-cine.hide-watchlist-ratings.v1";
export function readHideRatings(): boolean {
  try {
    return localStorage.getItem(HIDE_RATINGS_STORAGE) === "true";
  } catch {
    return false;
  }
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
