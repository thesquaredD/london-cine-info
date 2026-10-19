import { describe, expect, it } from "vitest";
import { filmPath, filmSlug, screeningId, shareUrl } from "./sharing";
import { readView, viewUrl } from "./catalogue";
import { clearFilters } from "./filters";
import type { Film } from "../shared/data";
import { filmPage } from "../../scripts/lib/film-pages";

describe("film links", () => {
  it("names the film in a filter-free URL that reads back as the open film", () => {
    const url = new URL(shareUrl({ id: "123", ti: "Amélie & Friends" }, "https://example.com"));
    expect(url.pathname).toBe("/film/123/amelie-friends/");
    expect(url.search).toBe("");
    const state = readView(url);
    expect(state).toMatchObject({ path: "/", film: "123", filmSlug: "amelie-friends" });
    expect(viewUrl(state)).toBe("/film/123/amelie-friends/");
    expect(viewUrl({ ...state, page: 2 })).toBe("/film/123/amelie-friends/?page=2");
    // Without the trailing slash (some apps trim it) the link still opens the film.
    expect(readView(new URL("https://example.com/film/123/amelie-friends")).film).toBe("123");
  });

  it("falls back to a neutral slug and keeps old ?film= links working", () => {
    expect(filmPath({ id: "123", ti: "東京" })).toBe("/film/123/film/");
    expect(filmSlug("  --Face/Off--  ")).toBe("face-off");
    expect(filmSlug(`${"a ".repeat(60)}`)).not.toMatch(/-$/);
    expect(readView(new URL("https://example.com/?film=123"))).toMatchObject({
      film: "123",
      filmSlug: undefined,
    });
    expect(readView(new URL("https://example.com/film/../etc/x/")).film).toBeUndefined();
  });

  it("clearing filters forgets the named film and its screening", () => {
    expect(clearFilters("/")).toMatchObject({ filmSlug: undefined, screening: undefined });
  });
});

describe("screening links", () => {
  const film = { id: "123", ti: "Film" };
  const row = { venue: "cinema.example", time: Date.parse("2026-10-25T01:30:00Z"), screen: "2" };

  it("tells apart simultaneous showings and the repeated hour when the clocks go back", () => {
    expect(screeningId({ ...row, time: row.time - 3600000 })).not.toBe(screeningId(row));
    expect(screeningId({ ...row, screen: "1" })).not.toBe(screeningId(row));
    expect(screeningId({ ...row, venue: "other.example" })).not.toBe(screeningId(row));
    // A missing screen is the same screening however a build leaves it out.
    expect(screeningId({ ...row, screen: null })).toBe(screeningId({ ...row, screen: "" }));
  });

  it.each([
    "2",
    "Screen 1, upstairs",
    'The "Big" one',
    "a&b=c#d?e+f %20 /",
    "Salle № 3 — été",
    "]}[{\\",
  ])("round-trips screen %j through a copied URL", (screen) => {
    const shared = { ...row, screen };
    const href = shareUrl(film, "https://example.com", shared);
    // What a reader pastes: the href text, parsed afresh.
    const state = readView(new URL(String(href)));
    expect(state.screening).toBe(screeningId(shared));
    expect(viewUrl(state)).toBe(new URL(href).pathname + new URL(href).search);
    expect(readView(new URL(viewUrl(state), "https://example.com")).screening).toBe(
      screeningId(shared),
    );
    // Only URL-safe characters reach the address, so messaging apps do not cut the link short.
    expect(href).toMatch(/^[A-Za-z0-9:/?=&%._~+-]+$/);
  });

  it("does not keep a screening without its film", () => {
    const state = readView(new URL('https://example.com/?screening=["a",1,null]'));
    expect(viewUrl(state)).toBe("/");
  });
});

describe("link previews", () => {
  const html = '<head><title>Generic</title><meta name="description" content="generic" /></head>';

  it("emits escaped film-specific preview metadata", () => {
    const page = filmPage(html, {
      ti: 'A <film> & "you" $$ $1 $`',
      ye: 2000,
      po: "https://example.com/poster.jpg",
    } as Film);
    expect(page).toContain(
      '<meta property="og:title" content="A &lt;film&gt; &amp; &quot;you&quot; $$ $1 $` (2000) — London Ciné Info" />',
    );
    expect(page).toContain("<title>A &lt;film&gt; &amp; &quot;you&quot; $$ $1 $` (2000)");
    expect(page).toContain('property="og:image" content="https://example.com/poster.jpg"');
    expect(page).toContain('name="twitter:card" content="summary_large_image"');
    expect(page).not.toContain("<film>");
    expect(page).not.toContain("Generic");
  });

  it("offers only an absolute https poster to crawlers", () => {
    for (const po of [null, "/poster.jpg", "http://example.com/p.jpg", "not a url"]) {
      const page = filmPage(html, { ti: "Film", ye: null, po } as Film);
      expect(page).not.toContain("og:image");
      expect(page).toContain('name="twitter:card" content="summary"');
    }
  });
});
