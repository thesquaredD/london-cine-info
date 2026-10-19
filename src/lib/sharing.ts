import type { Film, Showtime } from "../shared/data";

// Letters that Unicode does not decompose into a base letter plus accent.
const LETTERS: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  ø: "o",
  œ: "oe",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
  ı: "i",
};

/** A readable URL segment for a title; the film ID, not the slug, identifies the film. */
export function filmSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[ßæøœłđðþı]/g, (letter) => LETTERS[letter]!)
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100)
      .replace(/-$/, "") || "film"
  );
}

export function filmPath(film: Pick<Film, "id" | "ti">): string {
  return `/film/${encodeURIComponent(film.id)}/${filmSlug(film.ti)}/`;
}

type ScreeningKey = Pick<Showtime, "venue" | "time" | "screen">;

// UTC to the minute, written compactly: 2026-10-25T01:30Z becomes 20261025T0130Z.
const compact = (time: number) =>
  `${new Date(Math.floor(time / 60000) * 60000).toISOString().slice(0, 16).replace(/[-:]/g, "")}Z`;

/**
 * A readable screening reference: `<venue>~<UTC start>~<screen>`, for example
 * `princecharlescinema.com~20261025T0130Z~2`. Venue IDs never contain `~`, so the screen is
 * everything after the second one and may itself contain any character. The exact start
 * tells apart the repeated hour when the clocks go back. There is no booking URL: ticket
 * links change between catalogue updates.
 */
export function screeningId(row: ScreeningKey): string {
  return `${row.venue}~${compact(row.time)}~${row.screen ?? ""}`;
}

export type ScreeningReference = { venue: string; time: number; screen: string };

export function parseScreeningId(id: string): ScreeningReference | null {
  const [venue, time, ...screen] = id.split("~");
  const parts = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})Z$/.exec(time ?? "");
  if (!venue || !parts || !screen.length) return null;
  const [year, month, day, hour, minute] = parts.slice(1).map(Number) as number[];
  const ms = Date.UTC(year!, month! - 1, day, hour, minute);
  // Rejects impossible dates such as 20261340T2599Z rather than rolling them over.
  if (!Number.isFinite(ms) || compact(ms) !== time) return null;
  return { venue, time: ms, screen: screen.join("~") };
}

const londonDate = (time: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(time);

export type SharedMatch<T> = { row: T; timeChanged: boolean };

/**
 * Finds a shared screening in a film's programme. An exact match wins; otherwise the same
 * cinema and start on another screen, then the same cinema and London day within an hour
 * (a moved showing), each only when exactly one screening fits.
 */
export function findSharedScreening<T extends ScreeningKey>(
  id: string | undefined,
  rows: readonly T[],
): SharedMatch<T> | null {
  const shared = id ? parseScreeningId(id) : null;
  if (!shared) return null;
  const minute = (time: number) => Math.floor(time / 60000);
  const atVenue = rows.filter((row) => row.venue === shared.venue);
  const sameStart = atVenue.filter((row) => minute(row.time) === minute(shared.time));
  const exact = sameStart.find((row) => (row.screen ?? "") === shared.screen);
  if (exact) return { row: exact, timeChanged: false };
  if (sameStart.length === 1) return { row: sameStart[0]!, timeChanged: false };
  if (sameStart.length > 1) return null;
  const day = londonDate(shared.time);
  const near = atVenue.filter(
    (row) => Math.abs(row.time - shared.time) <= 3600000 && londonDate(row.time) === day,
  );
  return near.length === 1 ? { row: near[0]!, timeChanged: true } : null;
}

export function shareUrl(
  film: Pick<Film, "id" | "ti">,
  origin: string,
  row?: ScreeningKey,
): string {
  const url = new URL(filmPath(film), origin);
  // encodeURIComponent keeps `~` readable where URLSearchParams would write %7E.
  if (row) url.search = `screening=${encodeURIComponent(screeningId(row))}`;
  return url.href;
}
