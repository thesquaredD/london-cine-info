import { expect, it } from "vitest";
import { letterboxdSlug } from "./account";
it("matches only Letterboxd film URLs and exact slugs", () => {
  expect(letterboxdSlug("https://letterboxd.com/film/a-real-slug/")).toBe("a-real-slug");
  expect(letterboxdSlug("https://evil.example/film/a-real-slug/")).toBeNull();
  expect(letterboxdSlug("https://letterboxd.com/member/watchlist/")).toBeNull();
  expect(letterboxdSlug("malformed")).toBeNull();
});
