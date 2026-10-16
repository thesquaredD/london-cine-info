import type { CalendarScreening } from "@lci/core/calendar";
import { londonDate } from "@lci/core/filters";
export type GuestCinemas = { browserId: string; venues: string[] };
export type CinemaPreferences = { venues: string[]; version: number };
export function validVenues(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 1000 &&
    value.every((id) => typeof id === "string" && /^[a-zA-Z0-9._:-]{1,160}$/.test(id))
  );
}
export function cinemaMerge(guest: GuestCinemas) {
  return { browserId: guest.browserId, venues: [...new Set(guest.venues)] };
}
export function groupCalendar(rows: CalendarScreening[]) {
  const groups = new Map<string, CalendarScreening[]>();
  for (const row of [...rows].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))) {
    const date = londonDate(new Date(row.start));
    groups.set(date, [...(groups.get(date) ?? []), row]);
  }
  return [...groups];
}
