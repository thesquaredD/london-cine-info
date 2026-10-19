import { describe, expect, it } from "vitest";
import {
  filmPath,
  filmSlug,
  findSharedScreening,
  parseScreeningId,
  screeningId,
  shareUrl,
} from "./sharing";
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

  it("opens the film whatever the slug, so the app can correct it", () => {
    for (const path of ["/film/123/", "/film/123", "/film/123/Old-Title", "/film/123/am%C3%A9lie/"])
      expect(readView(new URL(path, "https://example.com"))).toMatchObject({
        path: "/",
        film: "123",
      });
    const missing = readView(new URL("https://example.com/film/123/"));
    expect(missing.filmSlug).toBe("");
    expect(viewUrl(missing)).toBe("/film/123/");
    expect(viewUrl({ ...missing, filmSlug: "the-title" })).toBe("/film/123/the-title/");
    expect(readView(new URL("https://example.com/film/123/a/b/")).film).toBeUndefined();
  });

  it("writes readable slugs, transliterating letters Unicode keeps whole", () => {
    expect(filmPath({ id: "123", ti: "東京" })).toBe("/film/123/film/");
    expect(filmSlug("  --Face/Off--  ")).toBe("face-off");
    expect(filmSlug("Der Große Diktator")).toBe("der-grosse-diktator");
    expect(filmSlug("Æon Flux: Søren, Œuvre, Łódź")).toBe("aeon-flux-soren-oeuvre-lodz");
    expect(filmSlug(`${"a ".repeat(60)}`)).not.toMatch(/-$/);
    expect(readView(new URL("https://example.com/?film=123"))).toMatchObject({
      film: "123",
      filmSlug: undefined,
    });
  });

  it("clearing filters forgets the named film and its screening", () => {
    expect(clearFilters("/")).toMatchObject({ filmSlug: undefined, screening: undefined });
  });
});

describe("screening links", () => {
  const film = { id: "123", ti: "Film" };
  // 01:30 UTC on 25 October 2026 is the second 01:30 in London as the clocks go back.
  const row = { venue: "cinema.example", time: Date.parse("2026-10-25T01:30:00Z"), screen: "2" };

  it("reads as venue, compact UTC start and screen", () => {
    expect(screeningId(row)).toBe("cinema.example~20261025T0130Z~2");
    expect(shareUrl(film, "https://example.com", row)).toBe(
      "https://example.com/film/123/film/?screening=cinema.example~20261025T0130Z~2",
    );
    expect(screeningId({ ...row, screen: null })).toBe("cinema.example~20261025T0130Z~");
    expect(parseScreeningId(screeningId(row))).toEqual(row);
  });

  it("tells apart simultaneous showings and the repeated hour when the clocks go back", () => {
    expect(screeningId({ ...row, time: row.time - 3600000 })).not.toBe(screeningId(row));
    expect(screeningId({ ...row, screen: "1" })).not.toBe(screeningId(row));
    expect(screeningId({ ...row, venue: "other.example" })).not.toBe(screeningId(row));
    expect(screeningId({ ...row, screen: null })).toBe(screeningId({ ...row, screen: "" }));
  });

  it.each([
    "2",
    "Screen 1, upstairs",
    'The "Big" one',
    "a&b=c#d?e+f %20 /",
    "Salle № 3 — été",
    "Studio ~ 2 ~ back",
    "]}[{\\",
  ])("round-trips screen %j through a copied URL and the app's own address", (screen) => {
    const shared = { ...row, screen };
    const href = shareUrl(film, "https://example.com", shared);
    const state = readView(new URL(String(href)));
    expect(state.screening).toBe(screeningId(shared));
    expect(parseScreeningId(state.screening!)).toEqual(shared);
    // The app rewrites its address with URLSearchParams; that must read back the same.
    expect(readView(new URL(viewUrl(state), "https://example.com")).screening).toBe(
      screeningId(shared),
    );
    // Only URL-safe characters reach the address, so messaging apps do not cut the link short.
    expect(href).toMatch(/^[A-Za-z0-9:/?=&%._~+-]+$/);
    expect(viewUrl(state)).toMatch(/^[A-Za-z0-9:/?=&%._~+-]+$/);
  });

  it.each(["", "nonsense", "a~b~c", "cinema.example~20261340T2599Z~1", '["a",1,null]'])(
    "ignores the malformed reference %j",
    (id) => {
      expect(parseScreeningId(id)).toBeNull();
      expect(findSharedScreening(id, [row])).toBeNull();
    },
  );

  it("does not keep a screening without its film", () => {
    const state = readView(new URL("https://example.com/?screening=a~20261025T0130Z~"));
    expect(viewUrl(state)).toBe("/");
  });

  describe("finding a shared screening that has changed", () => {
    const at = (iso: string, screen: string | null = "1", venue = "cinema.example") => ({
      venue,
      time: Date.parse(iso),
      screen,
    });
    const id = screeningId(at("2026-10-10T19:00:00Z", "1"));

    it("prefers the exact screening", () => {
      const exact = at("2026-10-10T19:00:00Z", "1");
      expect(findSharedScreening(id, [at("2026-10-10T19:00:00Z", "2"), exact])).toEqual({
        row: exact,
        timeChanged: false,
      });
    });

    it("accepts the same cinema and start on another screen when it is the only one", () => {
      const moved = at("2026-10-10T19:00:00Z", "3");
      expect(findSharedScreening(id, [moved])).toEqual({ row: moved, timeChanged: false });
      expect(findSharedScreening(id, [moved, at("2026-10-10T19:00:00Z", "4")])).toBeNull();
    });

    it("accepts a showing moved by up to an hour on the same London day, if unique", () => {
      const later = at("2026-10-10T19:45:00Z");
      expect(findSharedScreening(id, [later])).toEqual({ row: later, timeChanged: true });
      expect(findSharedScreening(id, [at("2026-10-10T20:01:00Z")])).toBeNull();
      expect(findSharedScreening(id, [later, at("2026-10-10T18:30:00Z")])).toBeNull();
      expect(
        findSharedScreening(id, [at("2026-10-10T19:30:00Z", "1", "other.example")]),
      ).toBeNull();
      // 23:30 London and 00:15 London the next day are within the hour but not the same day.
      const lateId = screeningId(at("2026-10-10T22:30:00Z"));
      expect(findSharedScreening(lateId, [at("2026-10-10T23:15:00Z")])).toBeNull();
    });
  });
});

describe("link previews", () => {
  const html = '<head><title>Generic</title><meta name="description" content="generic" /></head>';

  it("emits escaped film-specific preview metadata with a canonical URL", () => {
    const page = filmPage(
      html,
      {
        id: "abc",
        ti: 'A <film> & "you" $$ $1 $`',
        ye: 2000,
        po: "https://example.com/p.jpg",
      } as Film,
      "https://site.example",
    );
    expect(page).toContain(
      '<meta property="og:title" content="A &lt;film&gt; &amp; &quot;you&quot; $$ $1 $` (2000) — London Ciné Info" />',
    );
    expect(page).toContain("<title>A &lt;film&gt; &amp; &quot;you&quot; $$ $1 $` (2000)");
    expect(page).toContain(
      '<link rel="canonical" href="https://site.example/film/abc/a-film-you-1/" />',
    );
    expect(page).toContain(
      'property="og:url" content="https://site.example/film/abc/a-film-you-1/"',
    );
    expect(page).toContain('property="og:image" content="https://example.com/p.jpg"');
    expect(page).toContain('property="og:image:alt" content="A &lt;film&gt;');
    // Portrait posters crop badly in the large card.
    expect(page).toContain('name="twitter:card" content="summary"');
    expect(page).not.toContain("<film>");
    expect(page).not.toContain("Generic");
  });

  it("defaults the canonical origin to the production site", () => {
    expect(filmPage(html, { id: "x", ti: "X", ye: null, po: null } as Film)).toContain(
      'href="https://london-cine.info/film/x/x/"',
    );
  });

  it("offers only an absolute https poster to crawlers", () => {
    for (const po of [null, "/poster.jpg", "http://example.com/p.jpg", "not a url"]) {
      const page = filmPage(html, { id: "x", ti: "Film", ye: null, po } as Film);
      expect(page).not.toContain("og:image");
    }
  });
});
