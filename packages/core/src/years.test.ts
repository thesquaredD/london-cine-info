import { describe, expect, it } from "vitest";
import { readView, viewUrl } from "./catalogue";
import {
  decadeYears,
  normalizeYears,
  toggleDecade,
  toggleYear,
  yearMatches,
  yearSummary,
} from "./years";

describe("year selection", () => {
  it("unions multiple decades and individual years with exact boundaries", () => {
    const selection = { decades: [1980, 1990], years: [2001] };
    expect(
      [1979, 1980, 1989, 1990, 1999, 2000, 2001, null].filter((year) =>
        yearMatches(year, selection),
      ),
    ).toEqual([1980, 1989, 1990, 1999, 2001]);
    expect(yearMatches(null, {})).toBe(true);
  });
  it("removes one year from a decade, restores the whole decade, and preserves other selections", () => {
    const partial = toggleYear({ decades: [1990, 1980], years: [2001] }, 1994);
    expect(partial).toEqual({
      decades: [1980],
      years: [2001, 1999, 1998, 1997, 1996, 1995, 1993, 1992, 1991, 1990],
    });
    expect(toggleYear(partial, 1994)).toEqual({ decades: [1990, 1980], years: [2001] });
    expect(toggleDecade(partial, 1990)).toEqual({ decades: [1990, 1980], years: [2001] });
    expect(toggleDecade({ decades: [1990, 1980], years: [2001] }, 1990)).toEqual({
      decades: [1980],
      years: [2001],
    });
  });
  it("canonicalizes complete years and redundant, duplicate and invalid values", () => {
    expect(
      normalizeYears({
        decades: [1980, 1980, 1994, 1700],
        years: [1984, 2001, 2001, ...decadeYears(1990), NaN, 3000],
      }),
    ).toEqual({ decades: [1990, 1980], years: [2001] });
  });
  it("validates shared URLs and round-trips selections", () => {
    const state = readView(
      new URL(
        "https://example.com/?decade=1980&decade=1990&decade=1994&year=1994&year=2001&year=oops&year=2001&year=1800.5&year=1700",
      ),
    );
    expect(state.decades).toEqual([1990, 1980]);
    expect(state.years).toEqual([2001]);
    expect(readView(new URL(viewUrl(state), "https://example.com"))).toEqual(state);
  });
  it("keeps summaries compact", () => {
    expect(yearSummary({})).toBe("Any year");
    expect(yearSummary({ decades: [1990, 1980], years: [2001] })).toBe("1990s, 1980s + 1 year");
    expect(yearSummary({ years: [1991, 1992, 1993] })).toBe("3 years");
  });
});
