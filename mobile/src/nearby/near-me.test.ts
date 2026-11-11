import { describe, expect, it } from "vitest";
import type { DataMeta, Venue } from "@readograph/core/data";
import { initialView } from "../films/view-store";
import { nearMeAction, nearMeChanges, nearMePermission, nearMeResult } from "./near-me";

const origin = { lat: 51.5074, lon: -0.1278 };
// One degree of latitude is roughly 69 miles.
const venue = (id: string, northMiles: number | null): Venue => ({
  id,
  name: id,
  address: "",
  url: "",
  lat: northMiles === null ? NaN : origin.lat + northMiles / 69,
  lon: origin.lon,
  group: null,
  borough: "b",
  memberships: [],
});
const meta = {
  venues: [venue("far", 4.5), venue("near", 0.5), venue("middle", 1.5), venue("unknown", null)],
  facets: {
    venue: ["far", "near", "middle", "unknown"].map((id) => ({ id, label: id, count: 1 })),
  },
} as unknown as Pick<DataMeta, "venues" | "facets">;

describe("nearMePermission", () => {
  it("asks until the system stops offering the prompt, then sends the reader to Settings", () => {
    expect(nearMePermission({ granted: true, canAskAgain: true })).toBe("granted");
    expect(nearMePermission({ granted: false, canAskAgain: true })).toBe("ask");
    expect(nearMePermission({ granted: false, canAskAgain: false })).toBe("denied");
  });
});

describe("nearMeResult", () => {
  it("keeps cinemas within the radius, nearest first, and never an unknown location", () => {
    expect(nearMeResult(meta, origin, 2, new Set()).venues.map((v) => v.id)).toEqual([
      "near",
      "middle",
    ]);
    expect(nearMeResult(meta, origin, 5, new Set()).venues.map((v) => v.id)).toEqual([
      "near",
      "middle",
      "far",
    ]);
    expect(nearMeResult(meta, origin, 1, new Set()).venues.map((v) => v.id)).toEqual(["near"]);
  });

  it("has nothing before a location is found", () => {
    expect(nearMeResult(meta, null, 10, new Set())).toEqual({ venues: [], selected: [] });
  });

  it("ticks every cinema in range except those the reader unticked", () => {
    expect(nearMeResult(meta, origin, 5, new Set(["middle", "gone"])).selected).toEqual([
      "near",
      "far",
    ]);
  });
});

describe("nearMeChanges", () => {
  it("replaces the cinema filter and leaves My cinemas off", () => {
    const state = {
      ...initialView("/"),
      myCinemas: true,
      filters: { venue: ["old"], day: ["today"] },
      excluded: { venue: ["x"] },
    };
    expect(nearMeChanges(state, ["near"])).toEqual({
      myCinemas: false,
      filters: { venue: ["near"], day: ["today"] },
      excluded: { venue: [] },
      page: 1,
    });
  });

  it("labels the apply button", () => {
    expect(nearMeAction(1)).toBe("Show films at 1 cinema");
    expect(nearMeAction(3, true)).toBe("Show events at 3 cinemas");
    expect(nearMeAction(0)).toBe("Choose at least one cinema");
  });
});
