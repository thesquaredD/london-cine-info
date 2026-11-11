import type { ViewState } from "@readograph/core/catalogue";
import type { DataMeta } from "@readograph/core/data";
import type { Coordinates } from "@readograph/core/distance";
import { nearbyVenues, selectedVenues, type NearbyVenue } from "@readograph/core/nearby";

/**
 * The pure half of Near me in the app. The location comes from expo-location (foreground
 * permission, balanced accuracy); the cinemas within the chosen radius come from core's
 * `nearbyVenues`, which tests each distance with `withinRadius`.
 */

/** What the permission answer means for the screen. */
export type NearMePermission = "ask" | "granted" | "denied";

/**
 * expo-location's answer, reduced: granted; denied for good (the system will not show the
 * prompt again, so only Settings can change it); or not decided yet, or denied once on
 * Android where the prompt may still appear, in which case the app explains and asks.
 */
export function nearMePermission(answer: {
  granted: boolean;
  canAskAgain: boolean;
}): NearMePermission {
  if (answer.granted) return "granted";
  return answer.canAskAgain ? "ask" : "denied";
}

export type NearMeResult = {
  venues: NearbyVenue[];
  selected: string[];
};

/** The cinemas within `range` miles, nearest first, and which of them are ticked. */
export function nearMeResult(
  meta: Pick<DataMeta, "venues" | "facets">,
  point: Coordinates | null,
  range: number,
  excluded: ReadonlySet<string>,
): NearMeResult {
  const venues = nearbyVenues(meta, point, range);
  return { venues, selected: selectedVenues(venues, excluded) };
}

/**
 * Applying Near me: a temporary cinema filter, as on the website. Saved My cinemas stay
 * untouched, and any earlier cinema choices and exclusions are replaced.
 */
export function nearMeChanges(state: ViewState, venues: string[]): Partial<ViewState> {
  return {
    myCinemas: false,
    filters: { ...state.filters, venue: venues },
    excluded: { ...state.excluded, venue: [] },
    page: 1,
  };
}

/** The apply button's label: "Show films at 3 cinemas". */
export function nearMeAction(count: number, events = false): string {
  return count
    ? `Show ${events ? "events" : "films"} at ${count} ${count === 1 ? "cinema" : "cinemas"}`
    : "Choose at least one cinema";
}
