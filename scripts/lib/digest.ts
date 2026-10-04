import type { Film } from "../../src/shared/data";
import { letterboxdSlug } from "../../src/shared/account";
export type Alert = {
  slug: string;
  sent_at: number;
  last_screening_at: number;
  absent_since?: number | null;
};
export function digestFilms(
  films: Film[],
  watchlist: Set<string>,
  alerts: Alert[],
  now: number,
): Film[] {
  const previous = new Map(alerts.map((alert) => [alert.slug, alert]));
  return films.filter((film) => {
    const slug = letterboxdSlug(film.ra.lb?.url);
    if (!slug || !watchlist.has(slug) || !film.sc.length) return false;
    const alert = previous.get(slug);
    return !alert || (alert.absent_since != null && now - alert.absent_since > 30 * 86400);
  });
}
export function digestText(films: Film[], base: string, unsubscribe: string): string {
  return `New London screenings from your Letterboxd watchlist:\n\n${films.map((film) => `${film.ti}${film.ye ? ` (${film.ye})` : ""}\n${base}/watchlist?q=${encodeURIComponent(film.ti)}`).join("\n\n")}\n\nBrowse your watchlist: ${base}/watchlist\nUnsubscribe: ${unsubscribe}\n\nScreening data from Clusterflick. Availability can change; confirm with the cinema.`;
}
