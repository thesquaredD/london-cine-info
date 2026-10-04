import { describe, it, expect } from "vitest";
import { fetchWatchlist, parseWatchlist } from "./watchlist";
const html = (count: number, slugs: string[], pages = 1) =>
  `<span class="js-watchlist-count">${count.toLocaleString("en-US")} films</span>${slugs.map((slug) => `<li><div data-item-slug="${slug}" data-target-link="/film/${slug}/"></div></li>`).join("")}<a class="paginate-page">${pages}</a>`;
describe("public watchlist importer", () => {
  it("reads synthetic posters, tolerates attribute order and accepts a genuinely empty list", () => {
    expect(parseWatchlist(html(2, ["invented-one", "invented-two"]))).toEqual({
      slugs: ["invented-one", "invented-two"],
      count: 2,
      pages: 1,
    });
    expect(parseWatchlist(html(0, [])).slugs).toEqual([]);
  });
  it("fetches all pages, validates totals and deduplicates poster metadata", async () => {
    const urls: string[] = [];
    const result = await fetchWatchlist("synthetic-user", async (url) => {
      urls.push(url);
      return urls.length === 1 ? html(3, ["one", "two"], 2) : html(3, ["three"], 2);
    });
    expect(result.slugs).toEqual(["one", "three", "two"]);
    expect(urls[1]).toMatch("/page/2/");
  });
  it("rejects private/blocked markup, missing posters, partial pages and changing totals", async () => {
    expect(() => parseWatchlist("<h1>Private watchlist</h1>")).toThrow();
    expect(() => parseWatchlist(html(10, []))).toThrow();
    await expect(fetchWatchlist("user", async () => html(2, ["one"]))).rejects.toThrow("count");
    let call = 0;
    await expect(
      fetchWatchlist("user", async () =>
        ++call === 1 ? html(3, ["one"], 2) : html(4, ["two", "three"], 2),
      ),
    ).rejects.toThrow("changed");
  });
  it("rejects looping pagination and untrusted profile paths", async () => {
    await expect(fetchWatchlist("user", async () => html(2, ["one"], 2))).rejects.toThrow(
      "repeated",
    );
    await expect(fetchWatchlist("../admin", async () => html(0, []))).rejects.toThrow("username");
  });
});
