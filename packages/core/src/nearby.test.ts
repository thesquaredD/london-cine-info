import { describe, expect, it } from "vitest";
import type { DataMeta, Venue } from "./data";
import { nearbyVenues } from "./nearby";

const origin = { lat: 51.5074, lon: -0.1278 };
const venue = (id: string, northMiles: number, listed = true) => ({
  venue: {
    id,
    name: id,
    address: "",
    url: "",
    lat: origin.lat + northMiles / 69,
    lon: origin.lon,
    group: null,
    borough: "b",
    memberships: [],
  } satisfies Venue,
  listed,
});
const rows = [venue("a", 0.4), venue("b", 3), venue("c", 30), venue("closed", 0.1, false)];
const meta = {
  venues: rows.map((row) => row.venue),
  facets: {
    venue: rows.map((row) => ({ id: row.venue.id, label: "", count: row.listed ? 1 : 0 })),
  },
} as unknown as Pick<DataMeta, "venues" | "facets">;

describe("nearbyVenues", () => {
  it("tests each distance with withinRadius, so a radius of 0 means any distance", () => {
    expect(nearbyVenues(meta, origin, 1).map((v) => v.id)).toEqual(["a"]);
    expect(nearbyVenues(meta, origin, 0).map((v) => v.id)).toEqual(["a", "b", "c"]);
  });

  it("leaves out cinemas without listed screenings", () => {
    expect(nearbyVenues(meta, origin, 50).map((v) => v.id)).not.toContain("closed");
  });
});
