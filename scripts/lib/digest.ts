import type { Film, FilmShowtimes, Showtime, Venue } from "../../src/shared/data";
import { letterboxdSlug } from "../../src/shared/account";
import { addDays, londonDate } from "../../src/lib/filters";

export type Alert = {
  slug: string;
  sent_at: number;
  last_screening_at: number;
  absent_since?: number | null;
};
export type DigestFilm = {
  film: Film;
  slug: string;
  screenings: Showtime[];
  lastScreeningAt: number;
};
export type Digest = {
  cards: DigestFilm[];
  also: DigestFilm[];
  later: DigestFilm[];
  count: number;
  today: string;
};

// now and alert timestamps are seconds; showtime timestamps are milliseconds.
// The window includes London's date ten days ahead, even across a DST change.
export async function digestFilms(
  films: Film[],
  watchlist: Set<string>,
  alerts: Alert[],
  now: number,
  loadShowtimes: (id: string) => Promise<FilmShowtimes>,
): Promise<Digest> {
  const today = londonDate(new Date(now * 1000));
  const end = addDays(today, 10);
  const previous = new Map(alerts.map((alert) => [alert.slug, alert.last_screening_at]));
  const bySlug = new Map<string, DigestFilm>();
  for (const film of films) {
    const slug = letterboxdSlug(film.ra.lb?.url);
    if (!slug || !watchlist.has(slug)) continue;
    const data = await loadShowtimes(film.id);
    const screenings = Object.values(data.days)
      .flat()
      .filter((row) => row.time > now * 1000);
    const entry = bySlug.get(slug) ?? { film, slug, screenings: [], lastScreeningAt: 0 };
    entry.screenings.push(...screenings);
    bySlug.set(slug, entry);
  }
  const chosen: DigestFilm[] = [],
    later: DigestFilm[] = [];
  for (const entry of bySlug.values()) {
    entry.screenings = [
      ...new Map(
        entry.screenings.map((row) => [
          JSON.stringify([row.time, row.venue, row.bookingUrl, row.formats, row.screen]),
          row,
        ]),
      ).values(),
    ].sort((a, b) => a.time - b.time);
    const window = entry.screenings.filter((row) => londonDate(new Date(row.time)) <= end);
    if (!window.length) {
      if (entry.screenings.length) later.push(entry);
      continue;
    }
    const lastScreeningAt = Math.floor(window[window.length - 1]!.time / 1000);
    if (lastScreeningAt <= (previous.get(entry.slug) ?? 0)) continue;
    chosen.push({ ...entry, screenings: window, lastScreeningAt });
  }
  const soonest = (a: DigestFilm, b: DigestFilm) =>
    a.screenings[0]!.time - b.screenings[0]!.time || a.film.ti.localeCompare(b.film.ti);
  chosen.sort(soonest);
  later.sort(soonest);
  const available = chosen.filter((entry) => entry.screenings.some((row) => !row.soldOut));
  const cards = available.slice(0, 8);
  const cardSlugs = new Set(cards.map((entry) => entry.slug));
  return {
    cards,
    also: chosen.filter((entry) => !cardSlugs.has(entry.slug)),
    later,
    count: chosen.length,
    today,
  };
}

export type ScreeningLine = {
  label: string;
  url: string;
  formats: string[];
  notes: string | null;
  soldOut: boolean;
  count: number;
  time: number;
};
const shortDate = (time: number) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
  }).format(new Date(time));
const clock = (time: number) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(time));
const shortNote = (note: string | null) =>
  note && (note.length > 36 ? `${note.slice(0, 35)}…` : note);
export function screeningLines(entry: DigestFilm, venues: Venue[]): ScreeningLine[] {
  const byId = new Map(venues.map((venue) => [venue.id, venue]));
  const groups = new Map<string, Showtime[]>();
  for (const row of entry.screenings) {
    const group = byId.get(row.venue)?.group;
    if (!group) continue;
    const key = group;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const collapsed = new Set<Showtime>();
  const lines: ScreeningLine[] = [];
  for (const rows of groups.values()) {
    const count = new Set(rows.map((row) => row.venue)).size;
    if (count < 3) continue;
    rows.forEach((row) => collapsed.add(row));
    const first = rows[0]!,
      last = rows[rows.length - 1]!;
    const dates = [...new Set(rows.map((row) => londonDate(new Date(row.time))))];
    const daily =
      dates.length > 1 && dates.every((date, i) => i === 0 || date === addDays(dates[i - 1]!, 1));
    const span =
      dates.length > 1 ? `${shortDate(first.time)}–${shortDate(last.time)}` : shortDate(first.time);
    lines.push({
      label: `${daily ? `Daily (${span})` : span} · ${count} ${byId.get(first.venue)!.group} cinemas`,
      url: "",
      formats: [...new Set(rows.flatMap((row) => row.formats))],
      notes: rows.every((row) => row.notes === first.notes) ? shortNote(first.notes) : null,
      soldOut: rows.every((row) => row.soldOut),
      count: rows.length,
      time: first.time,
    });
  }
  for (const row of entry.screenings) {
    if (collapsed.has(row)) continue;
    lines.push({
      label: `${shortDate(row.time)} · ${clock(row.time)} — ${byId.get(row.venue)?.name ?? "Cinema"}`,
      url: row.bookingUrl,
      formats: row.formats,
      notes: shortNote(row.notes),
      soldOut: row.soldOut,
      count: 1,
      time: row.time,
    });
  }
  return lines.sort((a, b) => a.time - b.time);
}
function displayFormats(formats: string[]): string[] {
  const labels: Record<string, string> = {
    "4k": "4K",
    "4dx": "4DX",
    imax: "IMAX",
    "3d": "3D",
    screenx: "ScreenX",
  };
  return [
    ...new Set(
      formats
        .filter((format) => !["standard", "2d"].includes(format.toLowerCase()))
        .map((format) => labels[format.toLowerCase()] ?? format),
    ),
  ];
}
export const digestSubject = (digest: Digest) =>
  `${digest.count} of your watchlist films screen in London this week`;
const filmUrl = (entry: DigestFilm, base: string) =>
  `${base}/watchlist?q=${encodeURIComponent(entry.film.ti)}`;
const info = (film: Film) =>
  [film.di.map((person) => person.name).join(", "), film.ye, film.ru ? `${film.ru} min` : null]
    .filter(Boolean)
    .join(" · ");
const flag = (entry: DigestFilm, today: string) => {
  const date = londonDate(new Date(entry.screenings[0]!.time));
  return date === today ? "Tonight" : date === addDays(today, 1) ? "Tomorrow" : "";
};
const laterText = (digest: Digest) =>
  digest.later.length
    ? `${digest.later.length} more of your films have later dates (${digest.later
        .slice(0, 5)
        .map(
          (entry) =>
            `${entry.film.ti} — ${new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" }).format(new Date(entry.screenings[0]!.time))}`,
        )
        .join("; ")}). They appear the week they screen.`
    : "";
export function digestText(
  digest: Digest,
  venues: Venue[],
  base: string,
  unsubscribe: string,
): string {
  const parts = [digestSubject(digest), "Screenings in the next ten days:"];
  for (const entry of digest.cards) {
    const lines = screeningLines(entry, venues);
    const shown = lines.slice(0, 4);
    const remaining = entry.screenings.length - shown.reduce((sum, line) => sum + line.count, 0);
    parts.push(
      `${entry.film.ti}${flag(entry, digest.today) ? ` · ${flag(entry, digest.today)}` : ""}\n${info(entry.film)}\n${filmUrl(entry, base)}\n${shown.map((line) => [line.label, ...displayFormats(line.formats), line.notes, line.soldOut ? "Sold out" : "", line.url].filter(Boolean).join(" · ")).join("\n")}${remaining ? `\n+${remaining} more screenings` : ""}`,
    );
  }
  if (digest.also.length)
    parts.push(
      "Also in the next ten days",
      ...digest.also.map(
        (entry) =>
          `${entry.film.ti} — ${screeningLines({ ...entry, screenings: entry.screenings.slice(0, 1) }, venues)[0]!.label}${entry.screenings.every((row) => row.soldOut) ? " · Sold out" : ""}\n${filmUrl(entry, base)}`,
      ),
    );
  parts.push(
    laterText(digest),
    `Screening data from Clusterflick: https://clusterflick.com\nAvailability can change; confirm with the cinema.`,
    `Unsubscribe: ${unsubscribe}\nChange the day: ${base}/watchlist\nPrivacy: ${base}/privacy`,
  );
  return parts.filter(Boolean).join("\n\n");
}
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
const safeUrl = (value: string) => (/^https?:\/\//i.test(value) ? escape(value) : "");
const link = (label: string, url: string) =>
  safeUrl(url)
    ? `<a href="${safeUrl(url)}" style="color:#172e59;text-decoration:none">${escape(label)}</a>`
    : escape(label);
const chip = (label: string, soldOut = false) =>
  `<span style="display:inline-block;border:1px solid ${soldOut ? "#9d342b" : "#cccccc"};border-radius:4px;padding:1px 4px;margin:2px;font-size:11px;color:${soldOut ? "#9d342b" : "#444444"}">${escape(label)}</span>`;
const poster = (film: Film, width: number) => {
  const url = film.po?.startsWith("https://image.tmdb.org/")
    ? film.po.replace(/\/w\d+\//, "/w342/")
    : null;
  return url
    ? `<img src="${safeUrl(url)}" alt="" width="${width}" style="display:block;width:${width}px;max-width:${width}px;border-radius:4px" />`
    : "";
};
export function digestHtml(
  digest: Digest,
  venues: Venue[],
  base: string,
  unsubscribe: string,
): string {
  const cards = digest.cards
    .map((entry) => {
      const lines = screeningLines(entry, venues).slice(0, 4);
      const remaining = entry.screenings.length - lines.reduce((sum, line) => sum + line.count, 0);
      return `<tr><td style="padding:0 16px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #cccccc;border-radius:4px"><tr><td width="72" valign="top" style="padding:12px 8px 12px 12px">${poster(entry.film, 60)}</td><td valign="top" style="padding:12px 12px 12px 0;overflow-wrap:anywhere"><div style="font-size:18px;font-weight:500">${link(entry.film.ti, filmUrl(entry, base))} ${flag(entry, digest.today) ? chip(flag(entry, digest.today)) : ""}</div><div style="font-size:12px;color:#555555;margin:4px 0 8px">${escape(info(entry.film))}</div>${lines
        .map(
          (line) =>
            `<div style="font-size:13px;line-height:1.6;margin-top:5px">${link(line.label, line.url)} ${displayFormats(
              line.formats,
            )
              .map((format) => chip(format))
              .join(
                "",
              )} ${line.soldOut ? chip("Sold out", true) : ""}${line.notes ? `<div style="font-size:12px;color:#555555">${escape(line.notes)}</div>` : ""}</div>`,
        )
        .join(
          "",
        )}${remaining ? `<div style="font-size:12px;margin-top:8px">${link(`+${remaining} more screenings`, filmUrl(entry, base))}</div>` : ""}</td></tr></table></td></tr>`;
    })
    .join("");
  const also = digest.also.length
    ? `<tr><td style="padding:8px 16px"><div style="font-size:16px;font-weight:500;margin-bottom:8px">Also in the next ten days</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${digest.also.map((entry) => `<tr><td width="36" valign="top" style="padding:6px 8px 6px 0">${poster(entry.film, 28)}</td><td style="padding:6px 0">${link(entry.film.ti, filmUrl(entry, base))} ${entry.screenings.every((row) => row.soldOut) ? chip("Sold out", true) : ""}<div style="font-size:12px;color:#555555">${escape(screeningLines({ ...entry, screenings: entry.screenings.slice(0, 1) }, venues)[0]!.label)}</div></td></tr>`).join("")}</table></td></tr>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(digestSubject(digest))}</title></head><body style="margin:0;background:#eaeaea;font:14px Arial,Helvetica,sans-serif;color:#222222"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;table-layout:fixed"><tr><td style="background:#000000;color:#ffffff;padding:20px 16px;font-size:22px;font-weight:500">LONDON CINÉ INFO</td></tr><tr><td style="padding:20px 16px"><div style="font-size:20px;font-weight:500">${escape(digestSubject(digest))}</div><p style="margin-bottom:0">Your next ten days at the cinema.</p></td></tr>${cards}${also}<tr><td style="padding:16px;font-size:12px;line-height:1.6;border-top:1px solid #cccccc">${laterText(digest) ? `<p>${escape(laterText(digest))}</p>` : ""}<p>Screening data from ${link("Clusterflick", "https://clusterflick.com")}. Availability can change; confirm with the cinema.</p>${link("Unsubscribe", unsubscribe)} · ${link("Change the day", `${base}/watchlist`)} · ${link("Privacy", `${base}/privacy`)}</td></tr></table></td></tr></table></body></html>`;
}
