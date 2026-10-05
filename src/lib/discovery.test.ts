import { beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { loadBoroughs } from "../../scripts/lib/boroughs";
import { buildDataset } from "../../scripts/lib/transform";
import type { Combined, Matched } from "../../scripts/lib/schemas";
import type { DataMeta, Film, ScreeningFacet, SourceRelease } from "../shared/data";
import {
  addDays,
  dateShortcut,
  dayMatches,
  filterFilms,
  screeningMatcher,
  facetCounts,
} from "./filters";
import { readView, viewUrl } from "./catalogue";
import { radarEntries, radarFilms } from "./radar";
import { recoverySuggestions } from "./recovery";
let meta: DataMeta, prototype: Film;
beforeAll(async () => {
  const fixture = JSON.parse(
    await readFile(new URL("../../tests/fixtures/pipeline.json", import.meta.url), "utf8"),
  ) as {
    now: string;
    combined: Combined;
    matched: Matched;
    sources: { combined: SourceRelease; matched: SourceRelease };
  };
  const result = buildDataset(fixture.combined, fixture.matched, {
    now: new Date(fixture.now),
    sources: fixture.sources,
    boroughs: await loadBoroughs(),
  });
  meta = result.meta;
  prototype = result.films[0]!;
});
const state = (query = "", path = "/") =>
  readView(new URL(`${path}?${query}`, "https://test.local"));
const now = new Date("2026-10-03T16:00:00Z");
function row(epoch: string, format = "standard", venue = 0, soldOut: 0 | 1 = 0): ScreeningFacet {
  const instant = new Date(epoch);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (id: string) => parts.find((part) => part.type === id)!.value;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  let day = meta.facets.day.findIndex((option) => option.id === date);
  if (day < 0) {
    day = meta.facets.day.length;
    meta.facets.day.push({ id: date, label: date, count: 0 });
  }
  let index = meta.facets.format.findIndex((option) => option.id === format);
  if (index < 0) {
    index = meta.facets.format.length;
    meta.facets.format.push({ id: format, label: format, count: 0 });
  }
  return [
    day,
    Number(get("hour")) * 60 + Number(get("minute")),
    venue,
    2 ** index,
    0,
    soldOut,
    0,
    meta.screeningEpoch === undefined
      ? instant.getTime()
      : (instant.getTime() - meta.screeningEpoch) / 60000,
    null,
  ];
}
function film(id: string, screenings: ScreeningFacet[], ru: number | null = 119): Film {
  return { ...prototype, id, ti: id, sc: screenings, ru };
}
describe("date semantics", () => {
  it("uses adjacent seven-day windows across Sunday, year end and leap dates", () => {
    for (const today of ["2026-10-04", "2026-12-31", "2028-02-28"]) {
      for (let offset = -1; offset <= 14; offset++) {
        const date = addDays(today, offset);
        expect(dayMatches(date, ["this-week"], today)).toBe(offset >= 0 && offset <= 6);
        expect(dayMatches(date, ["week"], today)).toBe(offset >= 0 && offset <= 6);
        expect(dayMatches(date, ["next-week"], today)).toBe(offset >= 7 && offset <= 13);
      }
    }
  });
  it("Tonight sets visible time, removes exclusions and clears its range when leaving", () => {
    const initial = state("day=beyond&not_day=today&genre=drama&from=12:00");
    const tonight = { ...initial, ...dateShortcut(initial, "tonight") };
    expect(tonight).toMatchObject({
      tonight: true,
      from: "18:00",
      filters: { day: ["today"], genre: ["drama"] },
      excluded: { day: [] },
    });
    expect(readView(new URL(viewUrl(tonight), "https://test.local"))).toMatchObject({
      tonight: true,
      from: "18:00",
      filters: { day: ["today"] },
    });
    expect({ ...tonight, ...dateShortcut(tonight, "tomorrow") }).toMatchObject({
      tonight: false,
      from: "",
      to: "",
      filters: { day: ["tomorrow"] },
    });
    expect(dateShortcut(tonight, "tonight")).toMatchObject({
      tonight: false,
      from: "",
      filters: { day: [] },
    });
  });
  it("Tonight excludes elapsed starts, pre-18:00 screenings and tomorrow", () => {
    const input = film("tonight", [
      row("2026-10-03T16:30:00Z"),
      row("2026-10-03T17:00:00Z"),
      row("2026-10-04T17:00:00Z"),
    ]);
    expect(filterFilms([input], meta, state("tonight=1"), now)).toHaveLength(1);
    expect(
      filterFilms([input], meta, state("tonight=1"), new Date("2026-10-03T17:00:00Z")),
    ).toHaveLength(0);
  });
  it("preserves exact DST epochs for duplicate local hours", () => {
    const input = film("dst", [row("2026-10-25T00:30:00Z"), row("2026-10-25T01:30:00Z")]);
    expect(input.sc[0]![1]).toBe(input.sc[1]![1]);
    expect(
      radarEntries([input], meta, new Date("2026-10-25T00:45:00Z"))[0]!.screenings,
    ).toHaveLength(1);
    expect(
      radarEntries([input], meta, new Date("2026-10-25T00:00:00Z"))[0]!.screenings,
    ).toHaveLength(2);
  });
  it("ORs explicit dates, preserves exclusions and ANDs venue on the same screening", () => {
    const input = film("correlated", [
      row("2026-10-03T17:00:00Z", "standard", 0),
      row("2026-10-04T17:00:00Z", "standard", 1),
    ]);
    const venue = meta.facets.venue[0]!.id;
    expect(
      filterFilms(
        [input],
        meta,
        state(`day=2026-10-03&day=2026-10-04&not_day=2026-10-03&venue=${venue}`),
        now,
      ),
    ).toHaveLength(0);
    expect(
      filterFilms([input], meta, state(`day=2026-10-03&day=2026-10-04&venue=${venue}`), now),
    ).toHaveLength(1);
  });
  it("runtime is strictly below 120 and excludes unknown; counts share the limit", () => {
    const inputs = [119, 120, null].map((ru) =>
      film(String(ru), [row("2026-10-03T17:00:00Z")], ru),
    );
    expect(filterFilms(inputs, meta, state("short=1"), now).map((f) => f.id)).toEqual(["119"]);
    expect(facetCounts(inputs, meta, state("short=1"), now).day.get("today")).toBe(1);
  });
});
describe("Radar", () => {
  it("deduplicates, includes sold out, globally qualifies before local filters and expires", () => {
    const a = row("2026-10-03T17:00:00Z", "35mm", 0, 1);
    const input = film("scarce", [a, [...a], row("2026-10-04T17:00:00Z", "standard", 1)]);
    const entries = radarEntries([input], meta, now);
    expect(entries[0]!.screenings).toHaveLength(2);
    expect(radarFilms(entries, meta, state("available=1", "/radar"), "limited", now)).toHaveLength(
      1,
    );
    expect(entries[0]!.screenings).toHaveLength(2);
    expect(
      radarFilms(entries, meta, state(`venue=${meta.facets.venue[1]!.id}`, "/radar"), "film", now),
    ).toHaveLength(0);
    expect(
      radarEntries([input], meta, new Date("2026-10-04T18:00:00Z"))[0]!.screenings,
    ).toHaveLength(0);
  });
  it("never turns a widely listed film scarce through a venue/date filter", () => {
    const input = film(
      "wide",
      [0, 1, 2, 3].map((i) => row(`2026-10-0${3 + i}T17:00:00Z`, "standard", i % 2)),
    );
    const entries = radarEntries([input], meta, now);
    expect(radarFilms(entries, meta, state("day=today", "/radar"), "limited", now)).toHaveLength(0);
    expect(filterFilms([input], meta, state("day=today", "/radar"), now)).toHaveLength(0);
  });
  it("counts overlapping IMAX/70mm labels once and requires the qualifying screening", () => {
    const a = row("2026-10-03T17:00:00Z", "imax", 0);
    const b = row("2026-10-03T17:00:00Z", "imax-70mm", 0);
    a[3] |= b[3];
    const input = film("imax", [a, row("2026-10-04T17:00:00Z", "standard", 1)]);
    expect(radarEntries([input], meta, now)[0]!.special).toHaveLength(1);
    expect(
      radarFilms(
        radarEntries([input], meta, now),
        meta,
        state("day=tomorrow", "/radar"),
        "film",
        now,
      ),
    ).toHaveLength(0);
    const matcher = screeningMatcher(
      meta,
      { ...state("day=tomorrow", "/radar"), radarSection: "film" },
      now,
    );
    expect(
      matcher.showtime("2026-10-04", {
        venue: meta.facets.venue[1]!.id,
        time: Date.parse("2026-10-04T17:00:00Z"),
        localTime: "18:00",
        formats: ["standard"],
        accessibility: [],
        soldOut: false,
        screen: null,
        notes: null,
        category: "movie",
        bookingUrl: "https://test.local",
        bookingFallback: false,
      }),
    ).toBe(false);
  });
  it("orders by scarcity then nearest screening with stable titles", () => {
    const inputs = [
      film("z", [row("2026-10-04T17:00:00Z")]),
      film("a", [row("2026-10-03T17:00:00Z"), row("2026-10-04T17:00:00Z")]),
      film("b", [row("2026-10-03T17:00:00Z")]),
    ];
    expect(
      radarFilms(radarEntries(inputs, meta, now), meta, state("", "/radar"), "limited", now).map(
        (f) => f.id,
      ),
    ).toEqual(["b", "z", "a"]);
  });
});
it("empty-result adjustments count distinct films and preserve unrelated choices in URLs", () => {
  const input = film("long", [row("2026-10-04T17:00:00Z")], 120);
  const current = state("day=tomorrow&short=1&q=long");
  const suggestions = recoverySuggestions([input], meta, current, now);
  expect(suggestions.map((s) => s.label)).toEqual(["Remove the runtime limit"]);
  expect(suggestions[0]!.count).toBe(1);
  const next = { ...current, ...suggestions[0]!.changes };
  expect(viewUrl(next)).toContain("q=long&day=tomorrow");
  expect(filterFilms([input], meta, next, now)).toHaveLength(suggestions[0]!.count);
});

it("rejects malformed and impossible shared dates before opening the picker", () => {
  expect(
    state("day=2026-99-03&day=2026-02-31&day=2026-10-04&not_day=2026-13-12").filters.day,
  ).toEqual(["2026-10-04"]);
  expect(state("not_day=2026-13-12").excluded.day).toEqual([]);
});

it("splits generic IMAX from film and permits overlap with explicit IMAX 70mm", () => {
  const inputs = [
    film("digital-imax", [row("2026-10-03T17:00:00Z", "IMAX")]),
    film("film-imax", [row("2026-10-03T17:00:00Z", "IMAX 70mm")]),
    film("separate", [row("2026-10-03T17:00:00Z", "35mm"), row("2026-10-04T17:00:00Z", "imax", 1)]),
  ];
  const entries = radarEntries(inputs, meta, now);
  const current = state("", "/radar");
  expect(radarFilms(entries, meta, current, "film", now).map((film) => film.id)).toEqual([
    "film-imax",
    "separate",
  ]);
  expect(radarFilms(entries, meta, current, "imax", now)).toHaveLength(3);
  expect(
    radarFilms(entries, meta, { ...current, filmGauge: "70mm" }, "film", now).map(
      (film) => film.id,
    ),
  ).toEqual(["film-imax"]);
  expect(radarFilms(entries, meta, state("day=tomorrow", "/radar"), "film", now)).toHaveLength(0);
  expect(
    radarFilms(entries, meta, state("day=tomorrow", "/radar"), "imax", now).map((film) => film.id),
  ).toEqual(["separate"]);
});
