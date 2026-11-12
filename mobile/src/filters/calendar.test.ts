import { describe, expect, it } from "vitest";
import { adjacentMonth, monthCells, toggleDate } from "./calendar";

describe("Monday-first month grids", () => {
  it("pads both ends, including leap day and a six-row month", () => {
    const leap = monthCells("2028-02");
    expect(leap[0]).toBe(null);
    expect(leap[1]).toBe("2028-02-01");
    expect(leap.filter(Boolean)).toHaveLength(29);
    expect(leap).toHaveLength(35);
    expect(monthCells("2026-03")).toHaveLength(42);
    expect(monthCells("2026-03")[6]).toBe("2026-03-01");
  });
  it("keeps London DST boundary days exactly once", () => {
    for (const month of ["2026-03", "2026-10"]) {
      const days = monthCells(month).filter(Boolean);
      expect(days).toHaveLength(31);
      expect(new Set(days).size).toBe(31);
      expect(days.at(-1)).toBe(`${month}-31`);
    }
  });
  it("crosses years in both directions", () => {
    expect(adjacentMonth("2026-12", 1)).toBe("2027-01");
    expect(adjacentMonth("2027-01", -1)).toBe("2026-12");
  });
});
describe("date selection parity with the website", () => {
  it("replaces shortcuts with exact dates while retaining other dates and exclusions", () => {
    expect(toggleDate(["today", "2026-11-14"], ["2026-11-16"], "2026-11-15", false)).toEqual({
      selected: ["2026-11-14", "2026-11-15"],
      excluded: ["2026-11-16"],
    });
  });
  it("can clear an existing selection even in exclusion mode", () => {
    expect(toggleDate(["2026-11-14"], [], "2026-11-14", true)).toEqual({
      selected: [],
      excluded: [],
    });
    expect(toggleDate([], ["2026-11-14"], "2026-11-14", false)).toEqual({
      selected: [],
      excluded: [],
    });
  });
  it("preserves inclusions when excluding an exact date", () => {
    expect(toggleDate(["this-week"], [], "2026-11-14", true)).toEqual({
      selected: ["this-week"],
      excluded: ["2026-11-14"],
    });
  });
  it("replaces all dates/exclusions with a quick range, then clears on a second tap", () => {
    expect(toggleDate(["2026-11-14"], ["weekend"], "this-week", false)).toEqual({
      selected: ["this-week"],
      excluded: [],
    });
    expect(toggleDate(["this-week"], [], "this-week", false)).toEqual({
      selected: [],
      excluded: [],
    });
  });
  it("toggles a shortcut exclusion without discarding other dates", () => {
    expect(toggleDate(["today", "2026-11-14"], ["tomorrow"], "weekend", true)).toEqual({
      selected: ["today", "2026-11-14"],
      excluded: ["tomorrow", "weekend"],
    });
  });
});
