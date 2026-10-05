import { eventLabels, eventTypes } from "../data/event-rules";
import type { EventOccurrence, Film, FilmShowtimes } from "./data";
export function buildEventIndex(films: Film[], showtimes: FilmShowtimes[]): EventOccurrence[] {
  const byId = new Map(films.map((film) => [film.id, film]));
  const occurrences = new Map<string, EventOccurrence>();
  for (const programme of showtimes) {
    const film = byId.get(programme.id);
    for (const rows of Object.values(programme.days))
      for (const row of rows) {
        const title = row.eventTitle ?? film?.ti ?? programme.id;
        const labels = eventLabels(row.category, row.notes, title);
        if (!labels.length) continue;
        const id = JSON.stringify([programme.id, row.time, row.venue, row.screen]);
        const date = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/London",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(row.time));
        const existing = occurrences.get(id);
        if (existing) {
          existing.labels = [...new Set([...existing.labels, ...labels])];
          existing.types = [
            ...new Set([...existing.types, ...eventTypes(row.category, row.notes, title)]),
          ];
          existing.formats = [...new Set([...existing.formats, ...row.formats])];
          existing.accessibility = [...new Set([...existing.accessibility, ...row.accessibility])];
        } else
          occurrences.set(id, {
            ...row,
            eventTitle: title,
            id,
            filmId: programme.id,
            title,
            date,
            labels,
            types: eventTypes(row.category, row.notes, title),
          });
      }
  }
  return [...occurrences.values()].sort(
    (a, b) => a.time - b.time || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
}
