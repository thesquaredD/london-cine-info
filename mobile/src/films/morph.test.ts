import { describe, expect, it } from "vitest";
import {
  anchoredOffset,
  chooseAnchor,
  flightProgress,
  gridColumn,
  gridPoster,
  gridPosterRect,
  mixRect,
  planMorph,
  rowTextOpacity,
  rowThumbnailRect,
  visibleItems,
  type Rect,
} from "./morph";

const rect = (x: number, y: number, width = 10, height = 10): Rect => ({ x, y, width, height });

describe("grid geometry", () => {
  it("fits three 2:3 posters with 16 at the edges and 8 between on a 390-point screen", () => {
    const poster = gridPoster(390);
    expect(poster.width).toBeCloseTo((390 - 32 - 16) / 3);
    expect(poster.height).toBeCloseTo(poster.width * 1.5);
    const xs = [0, 130, 260].map((x) => gridPosterRect(rect(x, 0, 130, 0), 390, 0).x);
    expect(xs[0]).toBe(16);
    expect(xs[1]! - (xs[0]! + poster.width)).toBeCloseTo(8);
    expect(xs[2]! - (xs[1]! + poster.width)).toBeCloseTo(8);
    expect(390 - (xs[2]! + poster.width)).toBeCloseTo(16);
  });

  it("finds the column from the cell's x", () => {
    expect([0, 130, 260, 999].map((x) => gridColumn(x, 390))).toEqual([0, 1, 2, 2]);
  });

  it("puts rectangles in viewport coordinates", () => {
    expect(rowThumbnailRect(rect(0, 300, 390, 100), 250)).toEqual(rect(16, 64, 48, 72));
    expect(gridPosterRect(rect(0, 300, 130, 180), 390, 250).y).toBe(58);
  });
});

describe("scroll anchoring", () => {
  const rows = ["a", "b", "c", "d"].map((key, index) => ({
    key,
    layout: rect(0, 200 + index * 100, 390, 100),
  }));

  it("anchors the first film still showing at the top of the viewport", () => {
    expect(chooseAnchor(rows, 0)).toEqual({ key: "a", delta: 200 });
    expect(chooseAnchor(rows, 340)).toEqual({ key: "b", delta: -40 });
    // A sliver under 8 points does not count as showing.
    expect(chooseAnchor(rows, 395)).toEqual({ key: "c", delta: 5 });
    expect(chooseAnchor([], 0)).toBeNull();
  });

  it("keeps the anchor at the same distance from the top, within the content", () => {
    expect(anchoredOffset(500, -40, 10000)).toBe(540);
    expect(anchoredOffset(200, 200, 10000)).toBe(0);
    expect(anchoredOffset(5000, 0, 1200)).toBe(1200);
    expect(anchoredOffset(100, 300, -50)).toBe(0);
  });

  it("selects the cells that intersect the viewport", () => {
    expect(visibleItems(rows, 250, 200).map((item) => item.key)).toEqual(["a", "b", "c"]);
  });
});

describe("planMorph", () => {
  const list = new Map([
    ["a", rect(16, 0)],
    ["b", rect(16, 100)],
    ["gone", rect(16, 200)],
  ]);
  const grid = new Map([
    ["b", rect(150, 8)],
    ["a", rect(16, 8)],
    ["new", rect(16, 200)],
  ]);

  it("staggers in the grid's reading order going to posters", () => {
    const plan = planMorph(list, grid, true);
    expect(plan.flights.map((flight) => [flight.key, flight.delay, flight.fade])).toEqual([
      ["a", 0, "none"],
      ["b", 14, "none"],
      ["gone", 28, "out"],
      ["new", 42, "in"],
    ]);
    expect(plan.total).toBe(320 + 3 * 14);
  });

  it("reverses the order going back to the list", () => {
    const plan = planMorph(grid, list, false);
    expect(plan.flights.map((flight) => [flight.key, flight.delay])).toEqual([
      ["a", 42],
      ["b", 28],
      ["gone", 14],
      ["new", 0],
    ]);
    const gone = plan.flights.find((flight) => flight.key === "gone")!;
    expect(gone.fade).toBe("in");
    expect(gone.from).toEqual(gone.to);
  });

  it("is empty when nothing is visible", () => {
    expect(planMorph(new Map(), new Map(), true)).toEqual({
      flights: [],
      total: 0,
      toPosters: true,
    });
  });
});

describe("progress", () => {
  it("gives each poster its own 320 ms window inside the shared progress", () => {
    const total = 320 + 9 * 14;
    expect(flightProgress(0, total, 0)).toBe(0);
    expect(flightProgress(160 / total, total, 0)).toBeCloseTo(0.5);
    expect(flightProgress(160 / total, total, 126)).toBeCloseTo(34 / 320);
    expect(flightProgress(1, total, 126)).toBe(1);
    expect(flightProgress(0.5, 0, 0)).toBe(1);
  });

  it("fades the row text out over the first 160 ms, or in over the last 160 ms", () => {
    const total = 446;
    expect(rowTextOpacity(0, total, true)).toBe(1);
    expect(rowTextOpacity(80 / total, total, true)).toBeCloseTo(0.5);
    expect(rowTextOpacity(160 / total, total, true)).toBe(0);
    expect(rowTextOpacity(0.5, total, false)).toBe(0);
    expect(rowTextOpacity((total - 80) / total, total, false)).toBeCloseTo(0.5);
    expect(rowTextOpacity(1, total, false)).toBe(1);
  });

  it("mixes rectangles", () => {
    expect(mixRect(rect(0, 0, 48, 72), rect(100, 200, 112, 168), 0.5)).toEqual(
      rect(50, 100, 80, 120),
    );
  });
});
