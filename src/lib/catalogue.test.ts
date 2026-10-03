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
