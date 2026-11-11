import { describe, expect, it } from "vitest";
import { DEFAULT_DISPLAY } from "@readograph/core/display";
import type { DataMeta, Film, Showtime } from "@readograph/core/data";
import {
  bookingLabel,
  dayHeading,
  directorLine,
  factsLine,
  genreLine,
  nextScreening,
  ratingViews,
  rowRating,
  screeningDays,
  screeningTags,
  screeningWhen,
} from "./present";
import { createViewStore, initialView } from "./view-store";

// Tuesday 10 November 2026, 10:00 in London (GMT).
const now = new Date("2026-11-10T10:00:00Z");
const at = (iso: string) => Date.parse(iso);

const venue = (id: string, name: string) => ({
  id,
  name,
  address: "",
  url: "",
  lat: 51.5,
  lon: -0.1,
  group: null,
  borough: "westminster",
  memberships: [],
});

const meta: DataMeta = {
  schemaVersion: 2,
  generatedAt: "",
  upstreamGeneratedAt: "",
  sources: {
    combined: { repository: "", tag: "", publishedAt: "" },
    matched: { repository: "", tag: "", publishedAt: "" },
  },
  releaseDateSource: "tmdb-original",
  venues: [venue("pcc", "Prince Charles Cinema"), venue("bfi", "BFI Southbank")],
  boroughs: [],
  memberships: [],
  facets: {
    day: [
      { id: "2026-11-10", label: "Tue", count: 0 },
      { id: "2026-11-11", label: "Wed", count: 0 },
      { id: "2026-11-14", label: "Sat", count: 0 },
    ],
    time: [],
    venue: [
      { id: "pcc", label: "Prince Charles Cinema", count: 0 },
      { id: "bfi", label: "BFI Southbank", count: 0 },
    ],
    borough: [],
    membership: [],
    accessibility: [{ id: "ad", label: "Audio description", count: 0 }],
    format: [
      { id: "standard", label: "Standard", count: 0 },
      { id: "35mm", label: "35mm", count: 0 },
    ],
    genre: [
      { id: "drama", label: "Drama", count: 0 },
      { id: "horror", label: "Horror", count: 0 },
    ],
    language: [{ id: "en", label: "English", count: 0 }],
  },
  counts: { films: 1, screenings: 0, venues: 2 },
  diagnostics: {
    expiredScreenings: 0,
    duplicateScreenings: 0,
    invalidBookingUrls: [],
    outsideLondonVenues: [],
  },
};

function film(overrides: Partial<Film> = {}): Film {
  return {
    id: "devils",
    ti: "The Devils",
    o_ti: null,
    di: [{ id: "ken-russell", name: "Ken Russell" }],
    ye: 1971,
    rd: null,
    ru: 112,
    cl: "18",
    po: null,
    tr: null,
    la: "en",
    ge: ["drama", "horror"],
    ra: {
      lb: { value: 4.23, url: "https://letterboxd.com/film/the-devils/" },
      im: { value: 7.7, url: "" },
      mc: null,
      rt: null,
    },
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
    // [day, minute, venue, formats, access, soldOut, event, epoch (exact ms: no screeningEpoch)]
    sc: [
      [0, 9 * 60, 0, 1, 0, 0, 0, at("2026-11-10T09:00:00Z")], // already started
      [0, 14 * 60 + 30, 1, 2, 1, 0, 0, at("2026-11-10T14:30:00Z")],
      [0, 18 * 60, 0, 1, 0, 0, 0, at("2026-11-10T18:00:00Z")],
      [1, 12 * 60, 0, 1, 0, 0, 0, at("2026-11-11T12:00:00Z")],
    ],
    new: false,
    classic: true,
    upcoming: false,
    event: false,
    retro: [],
    unmatched: false,
    ...overrides,
  };
}

const showtime = (overrides: Partial<Showtime>): Showtime => ({
  venue: "pcc",
  time: at("2026-11-10T18:00:00Z"),
  localTime: "18:00",
  bookingUrl: "https://example.test/book",
  bookingFallback: false,
  screen: null,
  notes: null,
  category: "",
  formats: ["standard"],
  accessibility: [],
  soldOut: false,
  ...overrides,
});

describe("Films list rows", () => {
  it("summarises the next screening that has not started, with the other cinemas", () => {
    expect(nextScreening(film(), meta, initialView(), now)).toEqual({
      when: "14:30",
      where: "BFI Southbank +1 more",
    });
  });

  it("follows the active filters", () => {
    const state = { ...initialView(), filters: { venue: ["pcc"] } };
    expect(nextScreening(film(), meta, state, now)).toEqual({
      when: "18:00",
      where: "Prince Charles Cinema",
    });
  });

  it("is null when nothing upcoming matches", () => {
    expect(nextScreening(film({ sc: [] }), meta, initialView(), now)).toBeNull();
  });

  it("names the day for screenings after today", () => {
    expect(screeningWhen(at("2026-11-11T12:00:00Z"), now)).toBe("Tomorrow 12:00");
    expect(screeningWhen(at("2026-11-14T20:35:00Z"), now)).toBe("Sat 20:35");
    expect(screeningWhen(at("2026-12-12T20:35:00Z"), now)).toBe("12 Dec");
    // British Summer Time: 17:00 UTC is 18:00 in London.
    expect(screeningWhen(at("2026-07-01T17:00:00Z"), new Date("2026-07-01T08:00:00Z"))).toBe(
      "18:00",
    );
  });

  it("prints the director and year, and the row's rating", () => {
    expect(directorLine(film())).toBe("Ken Russell · 1971");
    expect(directorLine(film({ di: [], ye: null }))).toBe("");
    expect(rowRating(film(), initialView())).toEqual({ short: "LB", value: "4.23" });
    expect(rowRating(film(), { sort: "im" })).toEqual({ short: "IMDb", value: "7.7" });
    expect(rowRating(film(), { sort: "mc" })).toEqual({ short: "MC", value: "–" });
  });
});

describe("film detail", () => {
  it("prints the facts, language and genres", () => {
    expect(factsLine(film())).toBe("1971 · 1h 52m · 18");
    expect(genreLine(film(), meta)).toBe("English · Drama · Horror");
  });

  it("lists every rating in the reader's order with its link", () => {
    expect(
      ratingViews(film(), DEFAULT_DISPLAY.ratingOrder).map((rating) => [
        rating.short,
        rating.value,
        rating.scale,
        rating.url,
      ]),
    ).toEqual([
      ["LB", "4.23", "/5", "https://letterboxd.com/film/the-devils/"],
      ["IMDb", "7.7", "/10", null],
      ["MC", "–", "", null],
      ["RT", "–", "", null],
    ]);
  });

  it("groups screenings by day, drops started ones and orders by time then cinema", () => {
    const days = screeningDays(
      {
        "2026-11-11": [showtime({ time: at("2026-11-11T12:00:00Z"), localTime: "12:00" })],
        "2026-11-10": [
          showtime({ time: at("2026-11-10T09:00:00Z"), localTime: "09:00" }),
          showtime({ venue: "pcc" }),
          showtime({ venue: "bfi" }),
        ],
      },
      meta,
      initialView(),
      now,
    );
    expect(
      days.map((day) => [day.date, day.rows.map((row) => `${row.localTime} ${row.venue}`)]),
    ).toEqual([
      ["2026-11-10", ["18:00 bfi", "18:00 pcc"]],
      ["2026-11-11", ["12:00 pcc"]],
    ]);
    // Node and Hermes may differ on the comma; PR 0 item 1 checks Hermes on both platforms.
    expect(dayHeading("2026-11-10")).toMatch(/^Tuesday,? 10 November 2026$/);
  });

  it("labels screenings like the website", () => {
    expect(
      screeningTags(
        showtime({
          soldOut: true,
          formats: ["standard", "35mm"],
          accessibility: ["ad"],
          screen: "Screen 3",
        }),
        meta,
      ),
    ).toEqual(["Sold out", "35mm", "Audio description", "Screen 3"]);
    expect(bookingLabel({ bookingFallback: false, soldOut: false })).toBe("Book");
    expect(bookingLabel({ bookingFallback: true, soldOut: false })).toBe("Details");
    expect(bookingLabel({ bookingFallback: false, soldOut: true })).toBe("Details");
  });
});

describe("view store", () => {
  it("starts from the website's default view", () => {
    const store = createViewStore();
    expect(store.getState()).toMatchObject({
      path: "/",
      sort: "lb",
      direction: "desc",
      search: "",
    });
  });

  it("switches collection with that collection's default sort, keeping the search", () => {
    const store = createViewStore();
    store.setSearch("devils");
    store.sortBy("title");
    store.setCollection("/calendar");
    expect(store.getState()).toMatchObject({
      path: "/calendar",
      sort: "year",
      direction: "desc",
      search: "devils",
    });
  });

  it("flips the sort direction, then returns to the default", () => {
    const store = createViewStore();
    store.sortBy("title");
    expect(store.getState()).toMatchObject({ sort: "title", direction: "asc" });
    store.sortBy("title");
    expect(store.getState()).toMatchObject({ sort: "title", direction: "desc" });
    store.sortBy("title");
    expect(store.getState()).toMatchObject({ sort: "lb", direction: "desc" });
  });

  it("notifies subscribers", () => {
    const store = createViewStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => (calls += 1));
    store.setSearch("a");
    unsubscribe();
    store.setSearch("b");
    expect(calls).toBe(1);
  });
});
