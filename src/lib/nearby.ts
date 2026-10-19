import type { DataMeta, Venue } from "../shared/data";
import { distanceMiles, validCoordinates, type Coordinates } from "./distance";

/** Ranges offered by the nearby finder, in miles. */
export const NEARBY_RANGES = [1, 2, 3, 5, 10] as const;
export const DEFAULT_NEARBY_RANGE = 2;
export const NEARBY_TIMEOUT = 10000;

export type NearbyVenue = Venue & { distance: number };

/** Venues with screenings inside the range, nearest first; unknown locations never match. */
export function nearbyVenues(
  meta: Pick<DataMeta, "venues" | "facets">,
  origin: Coordinates | null,
  range: number,
): NearbyVenue[] {
  if (!origin) return [];
  const listed = new Set(
    meta.facets.venue.filter((option) => option.count > 0).map((option) => option.id),
  );
  return meta.venues
    .filter((venue) => listed.has(venue.id))
    .map((venue) => ({ ...venue, distance: distanceMiles(origin, venue) }))
    .filter((venue): venue is NearbyVenue => venue.distance !== null && venue.distance <= range)
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
}

/**
 * Exclusions are remembered by id, independent of the current range, so a cinema the reader
 * unchecked stays unchecked when it drops out of range and comes back. Anything not excluded
 * — including cinemas that newly enter the range — is selected.
 */
export function selectedVenues(venues: NearbyVenue[], excluded: ReadonlySet<string>): string[] {
  return venues.filter((venue) => !excluded.has(venue.id)).map((venue) => venue.id);
}
export function toggleExcluded(excluded: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(excluded);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
/** Select or clear every cinema currently shown, leaving out-of-range exclusions untouched. */
export function setAllExcluded(
  excluded: ReadonlySet<string>,
  venues: NearbyVenue[],
  exclude: boolean,
): Set<string> {
  const next = new Set(excluded);
  for (const venue of venues) {
    if (exclude) next.add(venue.id);
    else next.delete(venue.id);
  }
  return next;
}

export type LocationFailure =
  "invalid" | "not-found" | "denied" | "timeout" | "unavailable" | "service" | "network";
export class LocationError extends Error {
  constructor(
    public kind: LocationFailure,
    public source: "postcode" | "device",
  ) {
    super(kind);
  }
}
export type FoundLocation = { point: Coordinates; label: string; source: "postcode" | "device" };

const FULL_POSTCODE = /^([A-Z]{1,2}[0-9][A-Z0-9]?) ?([0-9][A-Z]{2})$/;
const OUTWARD_CODE = /^[A-Z]{1,2}[0-9][A-Z0-9]?$/;
/** A tidy UK postcode ("SW1A 2AA") or district ("N1"), or null when it cannot be one. */
export function normalisePostcode(value: string): { code: string; full: boolean } | null {
  const compact = value.toUpperCase().replace(/\s+/g, " ").trim();
  const full = FULL_POSTCODE.exec(compact);
  if (full) return { code: `${full[1]} ${full[2]}`, full: true };
  if (OUTWARD_CODE.test(compact)) return { code: compact, full: false };
  return null;
}

export async function lookupPostcode(
  input: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
  timeout = NEARBY_TIMEOUT,
): Promise<FoundLocation> {
  const postcode = normalisePostcode(input);
  if (!postcode) throw new LocationError("invalid", "postcode");
  // Combined by hand: AbortSignal.any and AbortSignal.timeout are missing on older iOS Safari.
  const request = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    request.abort();
  }, timeout);
  const forward = () => request.abort(signal.reason);
  if (signal.aborted) forward();
  else signal.addEventListener("abort", forward, { once: true });
  const fail = (failure: unknown, kind: LocationFailure) => {
    if (signal.aborted) throw failure;
    throw new LocationError(timedOut ? "timeout" : kind, "postcode");
  };
  try {
    let response: Response;
    try {
      response = await fetcher(
        `https://api.postcodes.io/${postcode.full ? "postcodes" : "outcodes"}/${encodeURIComponent(postcode.code)}`,
        { referrerPolicy: "no-referrer", signal: request.signal },
      );
    } catch (failure) {
      return fail(failure, "network");
    }
    if (response.status === 404) throw new LocationError("not-found", "postcode");
    if (!response.ok) throw new LocationError("service", "postcode");
    let data: { result?: { latitude?: unknown; longitude?: unknown; postcode?: unknown } };
    try {
      data = await response.json();
    } catch (failure) {
      return fail(failure, "service");
    }
    const point = { lat: Number(data.result?.latitude), lon: Number(data.result?.longitude) };
    if (!validCoordinates(point)) throw new LocationError("not-found", "postcode");
    return {
      point,
      label: typeof data.result?.postcode === "string" ? data.result.postcode : postcode.code,
      source: "postcode",
    };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", forward);
  }
}

type GeolocationLike = Pick<Geolocation, "getCurrentPosition">;
/**
 * The browser's own timeout excludes the permission prompt, so an ignored prompt would wait
 * forever; `patience` bounds the whole request, prompt included.
 */
export function locateDevice(
  geolocation: GeolocationLike | undefined,
  timeout = NEARBY_TIMEOUT,
  patience = NEARBY_TIMEOUT * 3,
): Promise<FoundLocation> {
  return new Promise((resolve, reject) => {
    if (!geolocation) {
      reject(new LocationError("unavailable", "device"));
      return;
    }
    const timer = setTimeout(() => reject(new LocationError("timeout", "device")), patience);
    geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        const point = { lat: position.coords.latitude, lon: position.coords.longitude };
        if (validCoordinates(point)) resolve({ point, label: "your location", source: "device" });
        else reject(new LocationError("unavailable", "device"));
      },
      (failure) => {
        clearTimeout(timer);
        reject(
          new LocationError(
            failure?.code === 1 ? "denied" : failure?.code === 3 ? "timeout" : "unavailable",
            "device",
          ),
        );
      },
      { timeout, maximumAge: 60000 },
    );
  });
}

/**
 * Hands out one live request at a time. Starting a request aborts the previous one, and only
 * the latest request may report back, so a slow earlier lookup can never replace a later one.
 */
export function createRequestGate() {
  let generation = 0;
  let controller: AbortController | null = null;
  return {
    start() {
      controller?.abort();
      controller = new AbortController();
      return { id: ++generation, signal: controller.signal };
    },
    isCurrent(id: number) {
      return id === generation;
    },
    cancel() {
      generation++;
      controller?.abort();
      controller = null;
    },
  };
}

export type RequestGate = ReturnType<typeof createRequestGate>;
/**
 * Runs `find` as the gate's latest request. Resolves with its outcome, or with null when a
 * later request or a cancel superseded it — whether or not the work honoured the abort.
 */
export async function runLatest<T>(
  gate: RequestGate,
  find: (signal: AbortSignal) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown } | null> {
  const { id, signal } = gate.start();
  try {
    const value = await find(signal);
    return gate.isCurrent(id) ? { ok: true, value } : null;
  } catch (error) {
    return gate.isCurrent(id) ? { ok: false, error } : null;
  }
}

export type NearbyStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "locating" }
  | { kind: "found"; label: string }
  | {
      kind: "failed";
      error: LocationFailure;
      source: "postcode" | "device";
      /** The location whose cinemas are still listed, if any. */
      previous?: string;
    };

export function milesLabel(range: number) {
  return `${range} ${range === 1 ? "mile" : "miles"}`;
}

/** The sentence beside the controls, plus whether it reports a problem. */
export function statusMessage(
  status: NearbyStatus,
  matches: number,
  range: number,
): { text: string; tone: "neutral" | "busy" | "success" | "error" } {
  switch (status.kind) {
    case "idle":
      return { text: "Enter a postcode or use your location.", tone: "neutral" };
    case "checking":
      return { text: "Checking postcode…", tone: "busy" };
    case "locating":
      return {
        text: "Waiting for your location. Allow access if your browser asks.",
        tone: "busy",
      };
    case "found":
      return matches
        ? {
            text: `${matches} ${matches === 1 ? "cinema" : "cinemas"} within ${milesLabel(range)} of ${status.label}.`,
            tone: "success",
          }
        : {
            text: `No cinemas within ${milesLabel(range)} of ${status.label}. Try a wider range.`,
            tone: "error",
          };
    case "failed":
      return {
        text:
          failureMessage(status.error, status.source) +
          (status.previous ? ` Still showing cinemas near ${status.previous}.` : ""),
        tone: "error",
      };
  }
}
export function failureMessage(error: LocationFailure, source: "postcode" | "device") {
  switch (error) {
    case "invalid":
      return "Enter a UK postcode, like SW1A 2AA, or a district, like N1.";
    case "not-found":
      return "We couldn’t find that postcode. Check it and try again.";
    case "denied":
      return "Location access is blocked. Enter a postcode, or allow location in your browser settings.";
    case "timeout":
      return source === "device"
        ? "Finding your location took too long. Try again or enter a postcode."
        : "The postcode check took too long. Try again.";
    case "unavailable":
      return "Your location isn’t available on this device. Enter a postcode instead.";
    case "network":
      return "We couldn’t reach the postcode service. Check your connection and try again.";
    case "service":
      return "The postcode service isn’t working right now. Try again, or use your location.";
  }
}
