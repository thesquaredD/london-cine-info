import { expect, it } from "vitest";
import {
  DEFAULT_DISPLAY,
  FILM_VIEW_STORAGE,
  readFilmView,
  saveFilmView,
  supportsPosters,
  watchlistDisplay,
} from "./display";
it("hides ratings only in watchlist contexts and preserves ordering", () => {
  const display = { ...DEFAULT_DISPLAY, hideWatchlistRatings: true };
  expect(watchlistDisplay(display, { path: "/watchlist" }).ratingOrder).toEqual([]);
  expect(watchlistDisplay(display, { path: "/", watchlist: true }).ratingOrder).toEqual([]);
  expect(watchlistDisplay(display, { path: "/" }).ratingOrder).toEqual(DEFAULT_DISPLAY.ratingOrder);
  expect(
    watchlistDisplay({ ...display, hideWatchlistRatings: false }, { path: "/watchlist" })
      .ratingOrder,
  ).toEqual(DEFAULT_DISPLAY.ratingOrder);
});

it("remembers the List / Posters choice and falls back to the list", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
  expect(readFilmView(storage)).toBe("list");
  expect(saveFilmView("posters", storage)).toBe(true);
  expect(store.get(FILM_VIEW_STORAGE)).toBe("posters");
  expect(readFilmView(storage)).toBe("posters");
  store.set(FILM_VIEW_STORAGE, "grid");
  expect(readFilmView(storage)).toBe("list");
  const blocked = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  expect(readFilmView(blocked)).toBe("list");
  expect(saveFilmView("posters", blocked)).toBe(false);
  expect(readFilmView(null)).toBe("list");
});
it("offers posters for film lists but keeps Events and Radar as they are", () => {
  expect(supportsPosters("/")).toBe(true);
  expect(supportsPosters("/watchlist")).toBe(true);
  expect(supportsPosters("/events")).toBe(false);
  expect(supportsPosters("/radar")).toBe(false);
});
