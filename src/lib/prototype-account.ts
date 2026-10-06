// Local-only adapter. Enabled explicitly with VITE_FRIENDS_PROTOTYPE=true.
// It never forwards requests to the account service.
import { loadCatalogue, loadShowtimes } from "./data";
import { sampleMember } from "./friends-prototype";
import { letterboxdSlug } from "../shared/account";
import type { CalendarScreening } from "../shared/calendar";
const catalogue = () => loadCatalogue(new AbortController().signal);
let saved: CalendarScreening[] | null = null;
let venues: string[] = [];
let signedIn = true;
export async function prototypeAccountApi(
  path: string,
  method: string,
  body?: unknown,
): Promise<unknown> {
  const data = await catalogue();
  const slugs = data.films
    .filter((f) => sampleMember(f, "dio"))
    .map((f) => letterboxdSlug(f.ra.lb?.url)!);
  const fetchedAt = Math.floor(Date.parse(data.meta.generatedAt) / 1000);
  if (path === "/api/me")
    return {
      user: signedIn
        ? {
            id: "prototype-dio",
            email: "dio@example.com",
            username: "dio",
            digestWeekday: 2,
            fetchedAt,
            count: slugs.length,
            stale: false,
            pending: false,
          }
        : null,
    };
  if (path === "/api/watchlist")
    return { slugs, fetchedAt, count: slugs.length, stale: false, username: "dio" };
  if (path === "/api/logout") {
    signedIn = false;
    return {};
  }
  if (path === "/api/cinemas") {
    if (method === "PUT") venues = (body as { venues: string[] }).venues;
    return { venues, version: 1 };
  }
  if (path === "/api/calendar") {
    if (!saved) {
      saved = [];
      for (const film of data.films
        .filter((f) => sampleMember(f, "dio") && f.sc.length)
        .slice(0, 6)) {
        const details = await loadShowtimes(film.id);
        const row = Object.values(details.days)
          .flat()
          .find((r) => r.time > Date.now());
        const venue = data.meta.venues.find((v) => v.id === row?.venue);
        if (row && venue)
          saved.push({
            id: String(saved.length + 1).padStart(64, "0"),
            filmId: film.id,
            title: film.ti,
            venueId: venue.id,
            venueName: venue.name,
            address: "",
            start: row.time,
            end: null,
            bookingUrl: row.bookingUrl,
            screen: row.screen,
            notes: row.notes,
            formats: row.formats,
          });
      }
    }
    if (method === "GET") return { screenings: saved };
  }
  throw new Error(
    "This action is not connected in the friends prototype. No account changes were sent.",
  );
}
