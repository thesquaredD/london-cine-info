import { RATINGS, runtime, type ViewState } from "@readograph/core/catalogue";
import type { DataMeta, Film, RatingKey, Showtime } from "@readograph/core/data";
import {
  filterLabel,
  londonDate,
  screeningMatcher,
  upcomingScreenings,
} from "@readograph/core/filters";

/**
 * What the Films list and the film detail screen print, as plain functions over core types so
 * that they are tested without React Native. Wording follows the website.
 */

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/London",
});
const weekdayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  timeZone: "Europe/London",
});
const dayHeadingFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/London",
});

export type NextScreening = {
  /** "18:00" today, "Tomorrow 18:00", or "Thu 18:00" later in the week; "12 Dec" beyond. */
  when: string;
  /** "Prince Charles Cinema", or "BFI Southbank +3 more" when other cinemas show it too. */
  where: string;
};

/**
 * The row's second line: the next screening that matches the current filters, and how many
 * other cinemas have a matching screening. Null when nothing upcoming matches.
 */
export function nextScreening(
  film: Film,
  meta: DataMeta,
  state: ViewState,
  now: Date,
): NextScreening | null {
  const matcher = screeningMatcher(meta, state, now);
  const rows = upcomingScreenings(film, meta, now).filter((row) => matcher.row(row, film));
  const next = rows[0];
  if (!next || next.epoch === null) return null;
  const others = new Set(
    rows.map((row) => row.venue?.id).filter((id) => id && id !== next.venue?.id),
  ).size;
  const name = next.venue?.name ?? "Unknown cinema";
  return { when: screeningWhen(next.epoch, now), where: others ? `${name} +${others} more` : name };
}

/** Today: "18:00"; tomorrow: "Tomorrow 18:00"; the next six days: "Thu 18:00"; later: "12 Dec". */
export function screeningWhen(epoch: number, now: Date): string {
  const today = londonDate(now);
  const day = londonDate(new Date(epoch));
  const time = timeFormat.format(epoch);
  if (day === today) return time;
  const days = Math.round(
    (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000,
  );
  if (days === 1) return `Tomorrow ${time}`;
  if (days < 7) return `${weekdayFormat.format(epoch)} ${time}`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  }).format(epoch);
}

/** "Elem Klimov · 1985", or just one of them when the other is unknown. */
export function directorLine(film: Film): string {
  return [film.di.map((director) => director.name).join(", "), film.ye ?? ""]
    .filter(Boolean)
    .join(" · ");
}

/** The detail screen's facts line: "1971 · 1h 52m · 18". */
export function factsLine(film: Film): string {
  return [film.ye, film.ru ? runtime(film.ru) : null, film.cl].filter(Boolean).join(" · ");
}

/** The detail screen's language and genres: "English · Drama · History". */
export function genreLine(film: Film, meta: DataMeta): string {
  return [
    film.la ? filterLabel("language", film.la, meta) : null,
    ...film.ge.map((id) => filterLabel("genre", id, meta)),
  ]
    .filter(Boolean)
    .join(" · ");
}

export type RatingView = {
  key: RatingKey;
  short: string;
  name: string;
  value: string;
  scale: string;
  url: string | null;
};

/** The ratings in the reader's order (the website's default until preferences arrive). */
export function ratingViews(film: Film, order: RatingKey[]): RatingView[] {
  return order.flatMap((key) => {
    const rating = RATINGS.find((item) => item.key === key);
    if (!rating) return [];
    const value = film.ra[key]?.value;
    return [
      {
        key,
        short: rating.short,
        name: rating.name,
        value: value == null ? "–" : String(value),
        scale: value == null ? "" : rating.scale,
        url: film.ra[key]?.url || null,
      },
    ];
  });
}

/** The list row's rating: Letterboxd, or the sort's rating when sorting by one. */
export function rowRating(
  film: Film,
  state: Pick<ViewState, "sort">,
): { short: string; value: string } {
  const rating = RATINGS.find((item) => item.key === state.sort) ?? RATINGS[0]!;
  const value = film.ra[rating.key]?.value;
  return { short: rating.short, value: value == null ? "–" : String(value) };
}

/** "TUESDAY, 10 NOVEMBER 2026" — set in capitals by the screen, as in the mock-up. */
export function dayHeading(date: string): string {
  return dayHeadingFormat.format(new Date(`${date}T12:00:00Z`));
}

/** The screening's detail line: sold out, then formats (not "standard"), access, the screen. */
export function screeningTags(row: Showtime, meta: DataMeta): string[] {
  const label = (key: "format" | "accessibility", id: string) =>
    meta.facets[key].find((option) => option.id === id)?.label ?? id;
  return [
    ...(row.soldOut ? ["Sold out"] : []),
    ...row.formats.filter((format) => format !== "standard").map((id) => label("format", id)),
    ...row.accessibility.map((id) => label("accessibility", id)),
    ...(row.screen ? [row.screen] : []),
  ];
}

/** Book when a booking page exists and seats remain; Details otherwise (the website's rule). */
export function bookingLabel(
  row: Pick<Showtime, "bookingFallback" | "soldOut">,
): "Book" | "Details" {
  return row.bookingFallback || row.soldOut ? "Details" : "Book";
}

/**
 * The detail screen's days: each London date with its screenings that match the current
 * filters and have not started, in time order, then cinema name.
 */
export function screeningDays(
  days: Record<string, Showtime[]>,
  meta: DataMeta,
  state: ViewState,
  now: Date,
): { date: string; rows: Showtime[] }[] {
  const matcher = screeningMatcher(meta, state, now);
  const venueName = new Map(meta.venues.map((venue) => [venue.id, venue.name]));
  const name = (id: string) => venueName.get(id) ?? id;
  return Object.entries(days)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => ({
      date,
      rows: rows
        .filter((row) => row.time > now.getTime() && matcher.showtime(date, row))
        .sort((a, b) => a.time - b.time || name(a.venue).localeCompare(name(b.venue))),
    }))
    .filter((day) => day.rows.length);
}
