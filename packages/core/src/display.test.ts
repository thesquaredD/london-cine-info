import { expect, it } from "vitest";
import { DEFAULT_DISPLAY, supportsPosters, watchlistDisplay } from "./display";
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

it("offers posters for film lists but keeps Events and Radar as they are", () => {
  expect(supportsPosters("/")).toBe(true);
  expect(supportsPosters("/watchlist")).toBe(true);
  expect(supportsPosters("/events")).toBe(false);
  expect(supportsPosters("/radar")).toBe(false);
});
