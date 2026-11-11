import { describe, expect, it } from "vitest";
import type { DataMeta } from "@readograph/core/data";
import { activeFilterCount, clearAllChanges, filterChips } from "./chips";
import { initialView } from "./view-store";

const option = (id: string, label: string) => ({ id, label, count: 1 });
const meta = {
  facets: {
    day: [option("2026-11-12", "Thu")],
    time: [option("evening", "Evening")],
    venue: [option("pcc", "Prince Charles Cinema"), option("bfi", "BFI Southbank")],
    borough: [],
    membership: [],
    accessibility: [],
    format: [option("imax", "IMAX")],
    genre: [option("horror", "Horror")],
    language: [],
  },
} as unknown as DataMeta;

const view = (changes: Parameters<typeof Object.assign>[1] = {}) => ({
  ...initialView("/"),
  ...changes,
});

describe("filterChips", () => {
  it("is empty when nothing is active, so the row takes no height", () => {
    expect(filterChips(view(), meta)).toEqual([]);
    expect(filterChips(view({ search: "devils" }), meta)).toEqual([]);
  });

  it("makes one chip per choice with the website's labels, exclusions as Not", () => {
    const state = view({
      filters: { day: ["today"], genre: ["horror"] },
      excluded: { format: ["imax"] },
    });
    expect(filterChips(state, meta).map((chip) => chip.label)).toEqual([
      "Today",
      "Not IMAX",
      "Horror",
    ]);
  });

  it("removes only its own choice", () => {
    const state = view({ filters: { venue: ["pcc", "bfi"] }, excluded: { venue: ["x"] } });
    const pcc = filterChips(state, meta).find((chip) => chip.key === "venue:pcc")!;
    expect(pcc.changes).toEqual({
      filters: { venue: ["bfi"] },
      page: 1,
    });
    const not = filterChips(state, meta).find((chip) => chip.key === "venue:not:x")!;
    expect(not.changes).toEqual({ excluded: { venue: [] }, page: 1 });
  });

  it("shows My cinemas and Tonight as one chip each instead of their parts", () => {
    const state = view({
      myCinemas: true,
      tonight: true,
      from: "18:00",
      filters: { venue: ["pcc", "bfi"], day: ["today"] },
    });
    expect(filterChips(state, meta).map((chip) => chip.label)).toEqual(["Tonight", "My cinemas"]);
  });

  it("lists the toggles, years and time range", () => {
    const state = view({
      independent: true,
      available: true,
      short: true,
      decades: [1970],
      years: [1985],
      from: "12:00",
    });
    expect(filterChips(state, meta).map((chip) => chip.label)).toEqual([
      "Starts 12:00–23:59",
      "Independent",
      "1970s",
      "1985",
      "No sold out",
      "Under 2 hours",
    ]);
  });
});

describe("activeFilterCount", () => {
  it("counts like the website's Filters button", () => {
    expect(activeFilterCount(view())).toBe(0);
    expect(
      activeFilterCount(
        view({
          filters: { day: ["today"], venue: ["pcc", "bfi"] },
          excluded: { genre: ["horror"] },
          from: "18:00",
          to: "22:00",
          short: true,
          decades: [1970],
        }),
      ),
    ).toBe(7);
  });
});

describe("clearAllChanges", () => {
  it("clears every filter but keeps the search text and the sort", () => {
    const state = view({
      search: "russell",
      sort: "year",
      direction: "asc",
      filters: { day: ["today"] },
      short: true,
    });
    const next = { ...state, ...clearAllChanges(state) };
    expect(next.filters).toEqual({});
    expect(next.short).toBe(false);
    expect(next.search).toBe("russell");
    expect(next.sort).toBe("year");
    expect(next.direction).toBe("asc");
    expect(filterChips(next, meta)).toEqual([]);
  });
});
