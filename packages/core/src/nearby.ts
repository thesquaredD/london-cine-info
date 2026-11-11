import type { DataMeta, Venue } from "./data";
import { distanceMiles, withinRadius, type Coordinates } from "./distance";

/**
 * The nearby finder's pure half, shared by the website (`src/lib/nearby.ts`, which adds the
 * browser's geolocation and the postcode lookup) and the phone app (which uses expo-location).
 */

/** Ranges offered by the nearby finder, in miles. */
export const NEARBY_RANGES = [1, 2, 3, 5, 10] as const;
export const DEFAULT_NEARBY_RANGE = 2;

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
    .filter(
      (venue): venue is NearbyVenue =>
        venue.distance !== null && withinRadius(venue.distance, range),
    )
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

export function milesLabel(range: number) {
  return `${range} ${range === 1 ? "mile" : "miles"}`;
}
