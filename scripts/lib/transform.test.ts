import {
  filterFilms,
  facetCounts,
  screeningMatcher,
  londonDate,
  dayMatches,
} from "../../src/lib/filters";
import { readView, viewUrl } from "../../src/lib/catalogue";
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBoroughs, polygonContains, type BoroughIndex } from "./boroughs";
import { buildDataset, encodeBitset } from "./transform";
import { londonTime } from "./time";
import type { Combined, Matched } from "./schemas";
import type { SourceRelease } from "../../src/shared/data";

type Fixture = {
  now: string;
  combined: Combined;
  matched: Matched;
  sources: { combined: SourceRelease; matched: SourceRelease };
};
let fixture: Fixture, boroughs: BoroughIndex;
beforeAll(async () => {
  fixture = JSON.parse(
    await readFile(new URL("../../tests/fixtures/pipeline.json", import.meta.url), "utf8"),
  ) as Fixture;
  boroughs = await loadBoroughs();
});
const build = (input = fixture) =>
  buildDataset(input.combined, input.matched, {
    now: new Date(input.now),
    sources: input.sources,
    boroughs,
  });

describe("data pipeline", () => {
  it("joins critic scores, preserves missing ratings, and converts movie metadata", () => {
    const { films, meta, showtimes } = build();
    const classic = films.find((film) => film.id === "classic-a")!;
    expect(classic.ra).toMatchObject({
      lb: { value: 4.25 },
      im: { value: 8.5 },
      mc: { value: 72 },
      rt: { value: 88 },
    });
    expect(classic.ru).toBe(120);
    expect(showtimes.find((film) => film.id === "classic-a")?.details.actors).toHaveLength(3);
    expect(classic.po).toBe("https://image.tmdb.org/t/p/w342/fixture.jpg");
    expect(films.find((film) => film.id === "classic-b")).toMatchObject({
      o_ti: "Titre B",
      la: "fr",
      ra: { lb: { value: null }, im: null },
    });
    expect(films.find((film) => film.id === "event")).toMatchObject({
      la: "unknown",
      unmatched: true,
      ru: null,
      ra: { lb: null },
    });
    expect(films.find((film) => film.id === "recent")?.ru).toBeNull();
    expect(meta.releaseDateSource).toBe("tmdb-original");
  });

  it("drops expired screenings and exact duplicates without hiding sold-out screenings", () => {
    const { films, showtimes, meta } = build();
    expect(meta.counts).toEqual({ films: 6, screenings: 9, venues: 4 });
    expect(meta.diagnostics).toMatchObject({ expiredScreenings: 2, duplicateScreenings: 1 });
    expect(films.some((film) => film.id === "expired")).toBe(false);
    expect(
      showtimes.find((film) => film.id === "classic-a")?.days["2026-10-03"]?.[0],
    ).toMatchObject({ soldOut: true, formats: ["35mm"], localTime: "14:00" });
    expect(
      showtimes.find((film) => film.id === "classic-a")?.days["2026-10-04"]?.[0]?.accessibility,
    ).toEqual(["subtitled"]);
  });

  it("keeps day, cinema and accessibility correlated within each screening", () => {
    const { films, meta } = build();
    const film = films.find((entry) => entry.id === "classic-a")!;
    const tuples = film.sc.map(([day, minute, venue, format, accessibility, soldOut]) => ({
      day: meta.facets.day[day]!.id,
      venue: meta.facets.venue[venue]!.id,
      minute,
      format,
      accessibility,
      soldOut,
    }));
    expect(tuples.find((row) => row.day === "2026-10-03")).toMatchObject({
      venue: "princecharlescinema.com",
      accessibility: 0,
      soldOut: 1,
    });
    expect(tuples.find((row) => row.day === "2026-10-04")).toMatchObject({
      venue: "bfi.org.uk-southbank",
      accessibility: 2,
    });
    expect(
      tuples.some((row) => row.day === "2026-10-03" && row.venue === "bfi.org.uk-southbank"),
    ).toBe(false);
    expect(meta.facets.venue.find((option) => option.id === "princecharlescinema.com")?.count).toBe(
      2,
    ); // distinct films, not screenings
  });

  it("sets page flags and counts distinct current films for retrospective directors", () => {
    const { films } = build();
    expect(films.find((film) => film.id === "recent")).toMatchObject({
      new: true,
      classic: false,
      upcoming: false,
    });
    expect(films.find((film) => film.id === "upcoming")).toMatchObject({
      new: false,
      upcoming: true,
    });
    expect(films.find((film) => film.id === "classic-a")).toMatchObject({
      classic: true,
      event: true,
      retro: ["director-a"],
    });
    expect(films.find((film) => film.id === "event")?.event).toBe(true);
    const input = structuredClone(fixture);
    delete input.combined.movies["classic-c"];
    expect(build(input).films.find((film) => film.id === "classic-a")?.retro).toEqual([]);
  });

  it("honours the inclusive 56-day new-release window and five-year calendar boundary", () => {
    const input = structuredClone(fixture);
    input.combined.movies.recent!.releaseDate = "2026-08-08";
    input.combined.movies["classic-a"]!.releaseDate = "2021-10-03";
    expect(build(input).films.find((film) => film.id === "recent")?.new).toBe(true);
    expect(build(input).films.find((film) => film.id === "classic-a")?.classic).toBe(false);
    input.combined.movies.recent!.releaseDate = "2026-08-07";
    input.combined.movies["classic-a"]!.releaseDate = "2021-10-02";
    expect(build(input).films.find((film) => film.id === "recent")?.new).toBe(false);
    expect(build(input).films.find((film) => film.id === "classic-a")?.classic).toBe(true);
  });

  it("fails loudly for malformed critical fields and broken references", () => {
    const input = structuredClone(fixture);
    input.combined.movies["classic-a"]!.performances[0]!.time = Number.NaN;
    expect(() => build(input)).toThrow(/combined.movies.classic-a.performances.0.time/);
    input.combined.movies["classic-a"]!.performances[0]!.time = Date.parse("2026-10-03T13:00:00Z");
    input.combined.movies["classic-a"]!.showings.pcc!.url = "javascript:alert(1)";
    expect(() => build(input)).toThrow(/HTTP\(S\)/);
    input.combined.movies["classic-a"]!.showings.pcc!.url = "https://example.com/details";
    input.combined.movies["classic-a"]!.performances[0]!.bookingUrl = "https://example.com";
    input.combined.movies["classic-a"]!.performances[0]!.showingId = "missing";
    expect(() => build(input)).toThrow(/unknown showing missing/);
    const brokenRating = structuredClone(fixture);
    brokenRating.matched.imdb["classic-a"]!.rating = 99;
    expect(() => build(brokenRating)).toThrow(/matched.imdb.classic-a.rating/);
  });

  it("replaces malformed booking links with validated showing details and reports the fallback", () => {
    for (const url of ["javascript:alert(1)", "https://www.ica.art%20https://example.com/film"]) {
      const input = structuredClone(fixture);
      input.combined.movies["classic-a"]!.performances[0]!.bookingUrl = url;
      const result = build(input);
      expect(
        result.showtimes.find((film) => film.id === "classic-a")?.days["2026-10-03"]?.[0],
      ).toMatchObject({
        bookingFallback: true,
        bookingUrl: "https://example.com/princecharlescinema.com",
      });
      expect(result.meta.diagnostics.invalidBookingUrls).toEqual([
        { movieId: "classic-a", showingId: "pcc" },
      ]);
    }
  });

  it("refuses to publish an empty dataset and encodes bits across byte boundaries", () => {
    const input = structuredClone(fixture);
    input.now = "2090-01-01T00:00:00Z";
    expect(() => build(input)).toThrow(/refusing to publish an empty dataset/);
    expect([...Buffer.from(encodeBitset([0, 7, 8, 15, 32], 33), "base64")]).toEqual([
      129, 129, 0, 0, 1,
    ]);
    expect(() => encodeBitset([33], 33)).toThrow(/Invalid facet index/);
  });

  it("normalizes numeric genre IDs from unmatched records before resolving facets", () => {
    const combined = {
      ...fixture.combined,
      genres: { ...fixture.combined.genres, "18": { id: "18", name: "Numeric Drama" } },
      movies: {
        ...fixture.combined.movies,
        event: { ...fixture.combined.movies.event!, genres: [18] },
      },
    };
    const result = buildDataset(combined, fixture.matched, {
      now: new Date(fixture.now),
      sources: fixture.sources,
      boroughs,
    });
    expect(result.films.find((film) => film.id === "event")?.ge).toEqual(["18"]);
    expect(result.meta.facets.genre.find((genre) => genre.id === "18")?.count).toBe(1);
  });
});

describe("London geography and time", () => {
  it("assigns real venues to boroughs and memberships while retaining outside locations", () => {
    const { meta } = build();
    expect(meta.boroughs.filter((borough) => borough.region !== "outside")).toHaveLength(33);
    expect(meta.venues.find((venue) => venue.id === "princecharlescinema.com")).toMatchObject({
      borough: "E09000033",
      memberships: ["prince-charles"],
    });
    expect(meta.venues.find((venue) => venue.id === "bfi.org.uk-southbank")).toMatchObject({
      borough: "E09000022",
      memberships: ["bfi"],
    });
    expect(
      meta.venues.find((venue) => venue.id === "picturehouses.com-central")?.memberships,
    ).toEqual(["picturehouse"]);
    expect(meta.diagnostics.outsideLondonVenues).toEqual(["outside.example"]);
    const square: [number, number][][] = [
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [0, 0],
      ],
      [
        [1, 1],
        [2, 1],
        [2, 2],
        [1, 2],
        [1, 1],
      ],
    ];
    expect(polygonContains([3, 3], square)).toBe(true);
    expect(polygonContains([1.5, 1.5], square)).toBe(false);
    expect(polygonContains([0, 2], square)).toBe(true);
    expect(polygonContains([5, 5], square)).toBe(false);
  });

  it("groups UTC timestamps into London dates and preserves both repeated DST hours", () => {
    expect(londonTime(Date.parse("2026-10-03T23:30:00Z"))).toMatchObject({
      date: "2026-10-04",
      time: "00:30",
      band: "morning",
    });
    const rows = build().showtimes.find((film) => film.id === "classic-a")!.days["2026-10-25"]!;
    expect(rows.map((row) => row.localTime)).toEqual(["01:30", "01:30"]);
    expect(rows[1]!.time - rows[0]!.time).toBe(3_600_000);
    expect(londonTime(Date.parse("2026-03-29T00:30:00Z")).time).toBe("00:30");
    expect(londonTime(Date.parse("2026-03-29T01:30:00Z")).time).toBe("02:30");
  });
});

describe("screening filters", () => {
  it("matches one screening across day, cinema, format and accessibility rather than mixing screenings", () => {
    const { films, meta } = build();
    const state = {
      ...readView(new URL("https://example.com")),
      filters: { day: ["2026-10-03"], venue: ["bfi.org.uk-southbank"] },
    };
    expect(
      filterFilms(films, meta, state, new Date(fixture.now)).some(
        (film) => film.id === "classic-a",
      ),
    ).toBe(false);
    state.filters.day = ["2026-10-04"];
    expect(
      filterFilms(films, meta, state, new Date(fixture.now)).some(
        (film) => film.id === "classic-a",
      ),
    ).toBe(true);
    const wrong = { ...state, filters: { ...state.filters, format: ["35mm"] } };
    expect(
      filterFilms(films, meta, wrong, new Date(fixture.now)).some(
        (film) => film.id === "classic-a",
      ),
    ).toBe(false);
    const matching = { ...state, filters: { ...state.filters, accessibility: ["subtitled"] } };
    expect(
      filterFilms(films, meta, matching, new Date(fixture.now)).some(
        (film) => film.id === "classic-a",
      ),
    ).toBe(true);
  });
  it("uses OR within a filter, AND across filters and shareable repeated query parameters", () => {
    const { films, meta } = build();
    const state = readView(
      new URL(
        "https://example.com/?day=2026-10-03&day=2026-10-04&venue=bfi.org.uk-southbank&venue=princecharlescinema.com",
      ),
    );
    expect(state.filters.day).toHaveLength(2);
    expect(
      filterFilms(films, meta, state, new Date(fixture.now)).some(
        (film) => film.id === "classic-a",
      ),
    ).toBe(true);
    expect(readView(new URL(viewUrl(state), "https://example.com"))).toEqual(state);
  });
  it("counts distinct films using matching screenings and ignores the facet being counted", () => {
    const { films, meta } = build();
    const state = {
      ...readView(new URL("https://example.com")),
      filters: { day: ["2026-10-03"], venue: ["bfi.org.uk-southbank"] },
    };
    const counts = facetCounts(films, meta, state, new Date(fixture.now));
    expect(counts.venue.get("princecharlescinema.com")).toBeGreaterThan(0);
    expect(counts.day.get("2026-10-04")).toBeGreaterThan(0);
    const onlyA = films.filter((film) => film.id === "classic-a");
    expect(
      facetCounts(
        onlyA,
        meta,
        readView(new URL("https://example.com")),
        new Date(fixture.now),
      ).day.get("2026-10-25"),
    ).toBe(1);
  });
  it("filters the expanded showtimes consistently, including sold-out and midnight ranges", () => {
    const { films, meta, showtimes } = build();
    const state = {
      ...readView(new URL("https://example.com")),
      filters: { day: ["2026-10-03"] },
      available: true,
    };
    expect(
      filterFilms(films, meta, state, new Date(fixture.now)).some(
        (film) => film.id === "classic-a",
      ),
    ).toBe(false);
    const late = { ...state, filters: { day: ["2026-10-25"] }, from: "23:00", to: "02:00" };
    const matcher = screeningMatcher(meta, late, new Date(fixture.now));
    expect(
      showtimes
        .find((film) => film.id === "classic-a")!
        .days["2026-10-25"]!.filter((row) => matcher.showtime("2026-10-25", row)),
    ).toHaveLength(2);
  });
  it("uses London dates and resolves weekend quick choices across month and DST boundaries", () => {
    expect(londonDate(new Date("2026-10-03T23:30:00Z"))).toBe("2026-10-04");
    expect(dayMatches("2026-10-04", ["weekend"], "2026-10-04")).toBe(true);
    expect(dayMatches("2026-10-10", ["weekend"], "2026-10-04")).toBe(false);
    expect(dayMatches("2026-11-01", ["week"], "2026-10-26")).toBe(true);
  });
});

it("applies exclusions to films and individual screenings, preserving positive OR choices", () => {
  const { films, meta, showtimes } = build();
  const state = {
    ...readView(new URL("https://example.com")),
    filters: { day: ["2026-10-03", "2026-10-04"] },
    excluded: { venue: ["princecharlescinema.com"], language: ["fr"] },
  };
  const selected = filterFilms(films, meta, state, new Date(fixture.now));
  expect(selected.some((film) => film.id === "classic-a")).toBe(true);
  expect(selected.some((film) => film.id === "classic-b")).toBe(false);
  const matcher = screeningMatcher(meta, state, new Date(fixture.now));
  const details = showtimes.find((film) => film.id === "classic-a")!;
  expect(
    details.days["2026-10-03"]!.filter((row) => matcher.showtime("2026-10-03", row)),
  ).toHaveLength(0);
  expect(
    details.days["2026-10-04"]!.filter((row) => matcher.showtime("2026-10-04", row)),
  ).toHaveLength(1);
  expect(readView(new URL(viewUrl(state), "https://example.com"))).toEqual(state);
  expect(
    facetCounts(films, meta, state, new Date(fixture.now)).venue.get("princecharlescinema.com"),
  ).toBeGreaterThan(0);
  const excludedDay = { ...state, excluded: { day: ["tomorrow"] } };
  expect(
    filterFilms(films, meta, excludedDay, new Date(fixture.now)).some(
      (film) => film.id === "classic-a",
    ),
  ).toBe(true);
  expect(
    screeningMatcher(meta, excludedDay, new Date(fixture.now)).showtime(
      "2026-10-04",
      details.days["2026-10-04"]![0]!,
    ),
  ).toBe(false);
});
