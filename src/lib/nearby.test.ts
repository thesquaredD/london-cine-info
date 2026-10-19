import { describe, expect, it, vi } from "vitest";
import type { DataMeta, Venue } from "../shared/data";
import {
  LocationError,
  createRequestGate,
  runLatest,
  locateDevice,
  lookupPostcode,
  nearbyVenues,
  normalisePostcode,
  selectedVenues,
  setAllExcluded,
  statusMessage,
  toggleExcluded,
} from "./nearby";

const origin = { lat: 51.5074, lon: -0.1278 };
function venue(id: string, northMiles: number | null): Venue {
  return {
    id,
    name: id,
    address: "",
    url: "",
    // One degree of latitude is roughly 69 miles.
    lat: northMiles === null ? NaN : origin.lat + northMiles / 69,
    lon: origin.lon,
    group: null,
    borough: "b",
    memberships: [],
  };
}
const meta = {
  venues: [
    venue("far", 4.5),
    venue("near", 0.5),
    venue("middle", 1.5),
    venue("unknown", null),
    venue("closed", 0.2),
  ],
  facets: {
    venue: [
      { id: "far", label: "far", count: 3 },
      { id: "near", label: "near", count: 1 },
      { id: "middle", label: "middle", count: 2 },
      { id: "unknown", label: "unknown", count: 2 },
      { id: "closed", label: "closed", count: 0 },
    ],
  },
} as unknown as Pick<DataMeta, "venues" | "facets">;

describe("nearby venues", () => {
  it("lists venues with screenings inside the range, nearest first", () => {
    expect(nearbyVenues(meta, origin, 2).map((v) => v.id)).toEqual(["near", "middle"]);
    expect(nearbyVenues(meta, origin, 5).map((v) => v.id)).toEqual(["near", "middle", "far"]);
    expect(nearbyVenues(meta, null, 5)).toEqual([]);
  });

  it("keeps exclusions across range changes and selects newly included venues", () => {
    let excluded: ReadonlySet<string> = new Set();
    const wide = nearbyVenues(meta, origin, 5);
    expect(selectedVenues(wide, excluded)).toEqual(["near", "middle", "far"]);
    excluded = toggleExcluded(excluded, "far");
    excluded = toggleExcluded(excluded, "near");
    // Narrowing drops "far" out of range; widening again must not re-select it.
    const narrow = nearbyVenues(meta, origin, 1);
    expect(selectedVenues(narrow, excluded)).toEqual([]);
    const middle = nearbyVenues(meta, origin, 2);
    expect(selectedVenues(middle, excluded)).toEqual(["middle"]);
    expect(selectedVenues(nearbyVenues(meta, origin, 5), excluded)).toEqual(["middle"]);
    excluded = toggleExcluded(excluded, "near");
    expect(selectedVenues(wide, excluded)).toEqual(["near", "middle"]);
  });

  it("select all and clear all only touch the cinemas shown", () => {
    const narrow = nearbyVenues(meta, origin, 2);
    let excluded: ReadonlySet<string> = new Set(["far"]);
    excluded = setAllExcluded(excluded, narrow, true);
    expect([...excluded].sort()).toEqual(["far", "middle", "near"]);
    excluded = setAllExcluded(excluded, narrow, false);
    expect([...excluded]).toEqual(["far"]);
  });
});

describe("postcodes", () => {
  it("normalises full postcodes and districts and rejects anything else", () => {
    expect(normalisePostcode(" sw1a2aa ")).toEqual({ code: "SW1A 2AA", full: true });
    expect(normalisePostcode("n1  9gu")).toEqual({ code: "N1 9GU", full: true });
    expect(normalisePostcode("e8")).toEqual({ code: "E8", full: false });
    expect(normalisePostcode("")).toBeNull();
    expect(normalisePostcode("London")).toBeNull();
    expect(normalisePostcode("SW1A 2A")).toBeNull();
  });

  const ok = (body: unknown, status = 200) =>
    vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(body), { status }),
    );
  async function failure(promise: Promise<unknown>) {
    try {
      await promise;
    } catch (error) {
      return error instanceof LocationError ? error.kind : error;
    }
    throw new Error("expected a failure");
  }

  it("looks up full postcodes and districts on the matching endpoint", async () => {
    const fetcher = ok({ result: { latitude: 51.5, longitude: -0.12, postcode: "SW1A 2AA" } });
    const found = await lookupPostcode("sw1a2aa", new AbortController().signal, fetcher);
    expect(found).toEqual({
      point: { lat: 51.5, lon: -0.12 },
      label: "SW1A 2AA",
      source: "postcode",
    });
    expect(String(fetcher.mock.calls[0]![0])).toBe("https://api.postcodes.io/postcodes/SW1A%202AA");
    const district = ok({ result: { latitude: 51.54, longitude: -0.1 } });
    expect((await lookupPostcode("n1", new AbortController().signal, district)).label).toBe("N1");
    expect(String(district.mock.calls[0]![0])).toBe("https://api.postcodes.io/outcodes/N1");
  });

  it("reports invalid input without a request, and each failure kind", async () => {
    const signal = new AbortController().signal;
    const unused = vi.fn();
    expect(await failure(lookupPostcode("not a postcode", signal, unused))).toBe("invalid");
    expect(unused).not.toHaveBeenCalled();
    expect(await failure(lookupPostcode("ZZ1 1ZZ", signal, ok({ error: "x" }, 404)))).toBe(
      "not-found",
    );
    expect(await failure(lookupPostcode("SW1A 2AA", signal, ok({}, 500)))).toBe("service");
    expect(
      await failure(lookupPostcode("SW1A 2AA", signal, ok({ result: { latitude: null } }))),
    ).toBe("not-found");
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await failure(lookupPostcode("SW1A 2AA", signal, offline))).toBe("network");
    const slow = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason)),
        ),
    );
    expect(await failure(lookupPostcode("SW1A 2AA", signal, slow as typeof fetch, 5))).toBe(
      "timeout",
    );
  });

  it("lets a cancelled lookup fail as an abort, not as a reader-facing error", async () => {
    const controller = new AbortController();
    const pending = lookupPostcode(
      "SW1A 2AA",
      controller.signal,
      ((_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason)),
        )) as typeof fetch,
    );
    controller.abort();
    const error = await failure(pending);
    expect(error).not.toBeInstanceOf(LocationError);
    expect((error as Error).name).toBe("AbortError");
  });
});

describe("device location", () => {
  const geolocation = (outcome: {
    coords?: { latitude: number; longitude: number };
    code?: number;
  }) => ({
    getCurrentPosition: (ok: PositionCallback, fail?: PositionErrorCallback | null) =>
      outcome.coords
        ? ok({ coords: outcome.coords } as GeolocationPosition)
        : fail?.({ code: outcome.code } as GeolocationPositionError),
  });
  const kind = (promise: Promise<unknown>) =>
    promise.then(
      () => "found",
      (error: LocationError) => error.kind,
    );

  it("times out when the permission prompt is never answered", async () => {
    const ignored = { getCurrentPosition: () => undefined };
    expect(await kind(locateDevice(ignored, 10000, 5))).toBe("timeout");
  });

  it("maps success, denial, timeout and unavailable positions", async () => {
    expect(
      await locateDevice(geolocation({ coords: { latitude: 51.5, longitude: -0.1 } })),
    ).toEqual({
      point: { lat: 51.5, lon: -0.1 },
      label: "your location",
      source: "device",
    });
    expect(await kind(locateDevice(geolocation({ code: 1 })))).toBe("denied");
    expect(await kind(locateDevice(geolocation({ code: 2 })))).toBe("unavailable");
    expect(await kind(locateDevice(geolocation({ code: 3 })))).toBe("timeout");
    expect(await kind(locateDevice(undefined))).toBe("unavailable");
    expect(await kind(locateDevice(geolocation({ coords: { latitude: 0, longitude: 0 } })))).toBe(
      "unavailable",
    );
  });
});

describe("request gate", () => {
  it("aborts and supersedes the previous request", () => {
    const gate = createRequestGate();
    const first = gate.start();
    const second = gate.start();
    expect(first.signal.aborted).toBe(true);
    expect(gate.isCurrent(first.id)).toBe(false);
    expect(gate.isCurrent(second.id)).toBe(true);
    gate.cancel();
    expect(second.signal.aborted).toBe(true);
    expect(gate.isCurrent(second.id)).toBe(false);
  });

  it("drops a slow earlier result even when the work ignores the abort", async () => {
    const gate = createRequestGate();
    let releaseSlow!: (value: string) => void;
    let failSlow!: (error: Error) => void;
    // Neither request listens to its signal, so only the gate can protect the latest result.
    const slow = runLatest(gate, () => new Promise<string>((resolve) => (releaseSlow = resolve)));
    const fast = runLatest(gate, async () => "second");
    expect(await fast).toEqual({ ok: true, value: "second" });
    releaseSlow("first");
    expect(await slow).toBeNull();

    const failing = runLatest(
      gate,
      () => new Promise<string>((_ok, reject) => (failSlow = reject)),
    );
    const later = runLatest(gate, async () => "later");
    failSlow(new Error("late failure"));
    expect(await failing).toBeNull();
    expect(await later).toEqual({ ok: true, value: "later" });

    const cancelled = runLatest(
      gate,
      () => new Promise<string>((resolve) => (releaseSlow = resolve)),
    );
    gate.cancel();
    releaseSlow("after cancel");
    expect(await cancelled).toBeNull();
    const error = new LocationError("denied", "device");
    expect(await runLatest(gate, async () => Promise.reject(error))).toEqual({ ok: false, error });
  });
});

describe("status messages", () => {
  it("names every state in plain words", () => {
    expect(statusMessage({ kind: "idle" }, 0, 2).tone).toBe("neutral");
    expect(statusMessage({ kind: "checking" }, 0, 2).text).toBe("Checking postcode…");
    expect(statusMessage({ kind: "locating" }, 0, 2).text).toMatch(/Allow access/);
    expect(statusMessage({ kind: "found", label: "N1" }, 3, 1)).toEqual({
      text: "3 cinemas within 1 mile of N1.",
      tone: "success",
    });
    expect(statusMessage({ kind: "found", label: "N1" }, 0, 2)).toEqual({
      text: "No cinemas within 2 miles of N1. Try a wider range.",
      tone: "error",
    });
    expect(
      statusMessage(
        { kind: "failed", error: "not-found", source: "postcode", previous: "N1" },
        4,
        2,
      ).text,
    ).toBe(
      "We couldn’t find that postcode. Check it and try again. Still showing cinemas near N1.",
    );
    for (const [error, source, pattern] of [
      ["invalid", "postcode", /UK postcode/],
      ["not-found", "postcode", /couldn’t find/],
      ["denied", "device", /blocked/],
      ["timeout", "device", /took too long/],
      ["timeout", "postcode", /took too long/],
      ["unavailable", "device", /isn’t available/],
      ["service", "postcode", /isn’t working/],
      ["network", "postcode", /connection/],
    ] as const)
      expect(statusMessage({ kind: "failed", error, source }, 0, 2)).toEqual({
        text: expect.stringMatching(pattern),
        tone: "error",
      });
  });
});
