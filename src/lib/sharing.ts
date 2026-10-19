import type { Film, Showtime } from "../shared/data";

/** A readable URL segment for a title; the film ID, not the slug, identifies the film. */
export function filmSlug(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100)
      .replace(/-$/, "") || "film"
  );
}

export function filmPath(film: Pick<Film, "id" | "ti">): string {
  return `/film/${encodeURIComponent(film.id)}/${filmSlug(film.ti)}/`;
}

// Venue, exact UTC start and screen distinguish simultaneous shows and repeated DST hours.
// No booking URL: cinema ticket links can change between catalogue updates. A missing screen
// is always null, so the ID stays stable whichever way a build leaves it out. The JSON is
// percent-encoded as a query value by URLSearchParams and compared as a whole string, so a
// mangled value simply matches nothing.
export function screeningId(row: Pick<Showtime, "venue" | "time" | "screen">): string {
  return JSON.stringify([row.venue, row.time, row.screen || null]);
}

export function shareUrl(
  film: Pick<Film, "id" | "ti">,
  origin: string,
  row?: Pick<Showtime, "venue" | "time" | "screen">,
): string {
  const url = new URL(filmPath(film), origin);
  if (row) url.searchParams.set("screening", screeningId(row));
  return url.href;
}
