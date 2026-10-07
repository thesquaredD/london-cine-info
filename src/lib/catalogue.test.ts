import { describe, expect, it } from "vitest";
import type { Film } from "../shared/data";
import { readView, viewUrl, selectFilms, sortFilms, tableRows } from "./catalogue";
function film(id: string, overrides: Partial<Film> = {}): Film {
  return {
    id,
    ti: id,
    o_ti: null,
    di: [],
    ye: null,
    rd: null,
    ru: null,
    cl: null,
    po: null,
    tr: null,
    la: "en",
    ge: [],
    ra: { lb: null, im: null, mc: null, rt: null },
    fa: {
      day: "",
      time: "",
      venue: "",
      borough: "",
      format: "",
      accessibility: "",
      membership: "",
      genre: "",
      language: "",
    },
    sc: [],
    new: false,
    classic: false,
    upcoming: false,
    event: false,
    retro: [],
    unmatched: false,
    ...overrides,
  };
}
const view = readView(new URL("https://example.com"));
describe("catalogue", () => {
  it("keeps unrated entries last in either direction and treats zero as a rating", () => {
    const films = [
      film("missing"),
      film("zero", {
        ra: { lb: { value: 0, url: "https://example.com" }, im: null, mc: null, rt: null },
      }),
      film("high", {
        ra: { lb: { value: 5, url: "https://example.com" }, im: null, mc: null, rt: null },
      }),
    ];
    expect(sortFilms(films, "lb", "asc").map((f) => f.id)).toEqual(["zero", "high", "missing"]);
    expect(sortFilms(films, "lb", "desc").map((f) => f.id)).toEqual(["high", "zero", "missing"]);
    expect(films.map((f) => f.id)).toEqual(["missing", "zero", "high"]);
  });
  it("breaks ties deterministically and sorts numeric titles naturally", () => {
    expect(
      sortFilms([film("Film 10"), film("Film 2"), film("a", { ti: "Film 2" })], "title", "asc").map(
        (f) => f.id,
      ),
    ).toEqual(["a", "Film 2", "Film 10"]);
  });
  it("searches original titles and directors without accents, combining filters", () => {
    const films = [
      film("a", {
        ti: "English",
        o_ti: "Cinéma Étrange",
        la: "fr",
        classic: true,
        di: [{ id: "d", name: "Agnès Varda" }],
      }),
      film("b"),
    ];
    expect(
      selectFilms(films, {
        ...view,
        path: "/classics",
        search: "cinema varDA",
        filters: { language: ["fr"] },
        director: "d",
      }).map((f) => f.id),
    ).toEqual(["a"]);
    expect(selectFilms(films, { ...view, path: "/events", search: "cinema" })).toEqual([]);
  });
  it("validates unknown routes, sorts and pages and round-trips shared filters", () => {
    expect(readView(new URL("https://example.com/unknown?sort=oops&page=-1"))).toEqual(view);
    const state = {
      ...view,
      path: "/classics",
      search: "A & B",
      filters: { language: ["fr"] },
      director: "d",
      sort: "title" as const,
      direction: "asc" as const,
      page: 2,
    };
    expect(readView(new URL(viewUrl(state), "https://example.com"))).toEqual(state);
    const calendar = { ...view, path: "/calendar" };
    expect(readView(new URL(viewUrl(calendar), "https://example.com"))).toEqual(calendar);
  });
});

it("groups retrospective films alphabetically by director, keeping each film's co-directors", () => {
  const a = { id: "a", name: "Alice" },
    z = { id: "z", name: "Zoe" };
  const films = [
    film("high", { di: [z, a], retro: ["z", "a"] }),
    film("low", { di: [a], retro: ["a"] }),
  ];
  const rows = tableRows(films, { ...view, path: "/retrospectives" });
  expect(rows.map((row) => [row.group?.name, row.film.id])).toEqual([
    ["Alice", "high"],
    ["Alice", "low"],
    ["Zoe", "high"],
  ]);
  expect(new Set(rows.map((row) => row.key)).size).toBe(3);
  expect(
    tableRows(films, { ...view, path: "/retrospectives", sort: "director", direction: "desc" })[0]
      ?.group?.name,
  ).toBe("Zoe");
  expect(tableRows(films, { ...view, path: "/retrospectives", director: "z" })).toHaveLength(1);
});

it("groups Calendar by source release date with unknown dates last, preserving each group's sort", () => {
  const rows = tableRows(
    [
      film("late", { rd: "2027-03-01" }),
      film("early-b", { rd: "2027-01-01" }),
      film("unknown"),
      film("early-a", { rd: "2027-01-01" }),
    ],
    { ...view, path: "/calendar" },
  );
  expect(rows.map((row) => row.film.id)).toEqual(["early-b", "early-a", "late", "unknown"]);
  expect(rows[0]!.group).toMatchObject({ name: "Released on 1 January 2027", count: 2 });
  expect(rows[3]!.group!.name).toContain("date unknown");
});
it("sorts original titles using the displayed title and falls back when one is missing", () => {
  const films = [film("A", { o_ti: "Zulu" }), film("B"), film("C", { o_ti: "Alpha" })];
  expect(sortFilms(films, "title", "asc", undefined, "original").map((f) => f.id)).toEqual([
    "C",
    "B",
    "A",
  ]);
  expect(sortFilms(films, "title", "asc").map((f) => f.id)).toEqual(["A", "B", "C"]);
});

// Film-level years must not turn into a requirement for a screening.
it("filters years for films without screenings and constrains other facet counts", async () => {
  const { filterFilms, facetCounts, clearFilters } = await import("./filters");
  const { countYears } = await import("./years");
  const meta: import("../shared/data").DataMeta = {
    schemaVersion: 1,
    generatedAt: "",
    upstreamGeneratedAt: "",
    sources: {
      combined: { repository: "", tag: "", publishedAt: "" },
      matched: { repository: "", tag: "", publishedAt: "" },
    },
    releaseDateSource: "tmdb-original",
    venues: [],
    boroughs: [],
    memberships: [],
    facets: {
      day: [],
      time: [],
      venue: [],
      borough: [],
      membership: [],
      accessibility: [],
      format: [],
      genre: [],
      language: [],
    },
    counts: { films: 3, screenings: 0, venues: 0 },
    diagnostics: {
      expiredScreenings: 0,
      duplicateScreenings: 0,
      invalidBookingUrls: [],
      outsideLondonVenues: [],
    },
  };
  const films = [
    film("a", { ye: 1994, ge: ["drama"] }),
    film("b", { ye: 2001, ge: ["comedy"] }),
    film("unknown", { ge: ["drama"] }),
  ];
  const state = { ...view, decades: [1990] };
  expect(filterFilms(films, meta, state).map((f) => f.id)).toEqual(["a"]);
  expect(facetCounts(films, meta, state).genre).toEqual(new Map([["drama", 1]]));
  const withoutYears = { ...state, decades: [], years: [], filters: { genre: ["comedy"] } };
  expect(countYears(filterFilms(films, meta, withoutYears))).toEqual(new Map([[2001, 1]]));
  expect(filterFilms(films, meta, { ...state, ...clearFilters("/") })).toHaveLength(3);
});

it("sorts runtimes in either direction with unknown values last and shares runtime order", () => {
  const films = [film("unknown"), film("short", { ru: 80 }), film("long", { ru: 150 })];
  expect(sortFilms(films, "runtime", "asc").map((f) => f.id)).toEqual(["short", "long", "unknown"]);
  expect(sortFilms(films, "runtime", "desc").map((f) => f.id)).toEqual([
    "long",
    "short",
    "unknown",
  ]);
  const state = { ...view, sort: "runtime" as const, direction: "asc" as const };
  expect(readView(new URL(viewUrl(state), "https://example.com"))).toEqual(state);
});
it("preserves explicitly chosen default ranking separately from reset order", async () => {
  const { hasCustomSort, nextSort } = await import("./catalogue");
  const explicit = { ...view, sortExplicit: true as const };
  expect(viewUrl(explicit)).toBe("/?sort=lb");
  expect(readView(new URL(viewUrl(explicit), "https://example.com"))).toEqual(explicit);
  expect(hasCustomSort(explicit)).toBe(true);
  const ascending = { ...explicit, ...nextSort(explicit, "lb") };
  expect(ascending.direction).toBe("asc");
  expect(hasCustomSort({ ...ascending, ...nextSort(ascending, "lb") })).toBe(false);
});
