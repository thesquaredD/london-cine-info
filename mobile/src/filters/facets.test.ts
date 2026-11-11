import { describe, expect, it } from "vitest";
import type { DataMeta } from "@readograph/core/data";
import { facetOptions, facetSummary, toggleOption } from "./facets";

const option = (id: string, label = id) => ({ id, label, count: 1 });
const venue = (id: string, borough: string) => ({ id, name: id, borough }) as never;
const meta = {
  venues: [venue("pcc", "westminster"), venue("rio", "hackney"), venue("odd", "nowhere")],
  boroughs: [
    { id: "westminster", name: "Westminster", region: "inner" },
    { id: "hackney", name: "Hackney", region: "inner" },
    { id: "bromley", name: "Bromley", region: "outer" },
  ],
  facets: {
    day: [option("2026-11-12", "Thu")],
    venue: [option("pcc"), option("rio"), option("odd")],
    borough: [option("westminster"), option("bromley"), option("elsewhere")],
    genre: [option("horror", "Horror")],
  },
} as unknown as DataMeta;

describe("facetOptions", () => {
  it("lists the day shortcuts before the dates", () => {
    expect(facetOptions("day", meta).map((item) => item.label)).toEqual([
      "Today",
      "Tomorrow",
      "This weekend",
      "This week",
      "Next week",
      "Next 7 days",
      "Later",
      "Thu 12 Nov",
    ]);
  });

  it("groups cinemas by borough and boroughs by region, groups in name order", () => {
    expect(facetOptions("venue", meta).map((item) => [item.group, item.id])).toEqual([
      ["Hackney", "rio"],
      ["Other cinemas", "odd"],
      ["Westminster", "pcc"],
    ]);
    expect(facetOptions("borough", meta).map((item) => item.group)).toEqual([
      "Inner London",
      "Other places",
      "Outer London",
    ]);
  });
});

describe("facetSummary", () => {
  it("summarises as the website does", () => {
    expect(facetSummary("venue", "Cinema", [], [], meta)).toBe("Any cinema");
    expect(facetSummary("genre", "Genre", ["horror"], [], meta)).toBe("Horror");
    expect(facetSummary("genre", "Genre", ["a", "b"], [], meta)).toBe("2 selected");
    expect(facetSummary("genre", "Genre", ["a"], ["b"], meta)).toBe("1 included · 1 excluded");
    expect(facetSummary("time", "Time", [], [], meta, "Starts 18:00–23:59")).toBe(
      "Starts 18:00–23:59",
    );
  });
});

describe("toggleOption", () => {
  it("includes, excludes in exclude mode, and clears on a second tap", () => {
    expect(toggleOption([], [], "a", false)).toEqual({ selected: ["a"], excluded: [] });
    expect(toggleOption([], [], "a", true)).toEqual({ selected: [], excluded: ["a"] });
    expect(toggleOption(["a"], [], "a", true)).toEqual({ selected: [], excluded: [] });
    expect(toggleOption([], ["a"], "a", false)).toEqual({ selected: [], excluded: [] });
  });
});
