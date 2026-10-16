export * from "@lci/core/display";
export const HIDE_RATINGS_STORAGE = "london-cine.hide-watchlist-ratings.v1";
export function readHideRatings(): boolean {
  try {
    return localStorage.getItem(HIDE_RATINGS_STORAGE) === "true";
  } catch {
    return false;
  }
}
