import { expect, it } from "vitest";
import { digestFilms, digestHtml, digestSubject, digestText, screeningLines } from "./digest";
import type { Film, FilmShowtimes, Showtime, Venue } from "../../src/shared/data";
const now = Date.parse("2026-10-04T12:00:00Z") / 1000;
const film = (id: string, slug = id) =>
  ({
    id,
    ti: id,
    ye: 2001,
    di: [{ id: "d", name: "Director" }],
    ru: 100,
    po: "https://image.tmdb.org/t/p/w500/poster.jpg",
    ra: { lb: { url: `https://letterboxd.com/film/${slug}/`, value: 4 } },
  }) as Film;
const row = (date: string, extra: Partial<Showtime> = {}) =>
  ({
    venue: "v1",
    time: Date.parse(date),
    localTime: "18:20",
    bookingUrl: "https://cinema.test/book",
    formats: ["35mm"],
    notes: null,
    soldOut: false,
    ...extra,
  }) as Showtime;
const venue = (id: string, group: string | null = null) =>
  ({ id, name: `Cinema ${id}`, group }) as Venue;
const venues = [venue("v1"), ...["a", "b", "c"].map((id) => venue(id, "Cineworld"))];
function build(
  films: Film[],
  rows: Record<string, Showtime[]>,
  alerts: Parameters<typeof digestFilms>[2] = [],
  timestamp = now,
) {
  return digestFilms(
    films,
    new Set(films.map((f) => new URL(f.ra.lb!.url).pathname.split("/")[2]!)),
    alerts,
    timestamp,
    async (id) =>
      ({
        id,
        details: { actors: [], overview: null },
        days: { ignored: rows[id] ?? [] },
      }) as FilmShowtimes,
  );
}
it("limits to future screenings through London's date +10 and keeps later films separate", async () => {
  const result = await build([film("now"), film("edge"), film("later"), film("past")], {
    now: [row("2026-10-04T12:00:00Z"), row("2026-10-04T18:20:00Z")],
    edge: [row("2026-10-14T22:59:59Z")],
    later: [row("2026-10-14T23:00:00Z")],
    past: [row("2026-10-03T18:20:00Z")],
  });
  expect(result.cards.map((e) => e.slug)).toEqual(["now", "edge"]);
  expect(result.cards[0]!.screenings).toHaveLength(1);
  expect(result.later.map((e) => e.slug)).toEqual(["later"]);
  expect(digestSubject(result)).toBe("2 of your watchlist films screen in London this week");
  expect(
    digestText(result, venues, "https://example.com", "https://example.com/unsubscribe"),
  ).toContain("They appear the week they screen");
});
it("uses London calendar dates across DST rather than a fixed number of hours", async () => {
  const result = await build(
    [film("end"), film("outside")],
    { end: [row("2026-10-28T23:59:59Z")], outside: [row("2026-10-29T00:00:00Z")] },
    [],
    Date.parse("2026-10-18T12:00:00Z") / 1000,
  );
  expect(result.count).toBe(1);
});
it("announces new window epochs and does not resend already announced screenings", async () => {
  const screening = row("2026-10-05T18:20:00Z");
  const sent = [{ slug: "a", sent_at: now, last_screening_at: screening.time / 1000 }];
  expect((await build([film("a")], { a: [screening] }, sent)).count).toBe(0);
  const next = await build([film("a")], { a: [screening, row("2026-10-06T18:20:00Z")] }, sent);
  expect(next.count).toBe(1);
  expect(next.cards[0]!.lastScreeningAt).toBe(Date.parse("2026-10-06T18:20:00Z") / 1000);
  expect(
    (await build([film("a")], { a: [screening] }, [{ ...sent[0]!, last_screening_at: now }])).count,
  ).toBe(1);
});
it("deduplicates shared Letterboxd slugs without dropping their screenings", async () => {
  const result = await build([film("one", "same"), film("two", "same")], {
    one: [row("2026-10-05T18:20:00Z")],
    two: [row("2026-10-06T18:20:00Z")],
  });
  expect(result.count).toBe(1);
  expect(result.cards[0]!.screenings).toHaveLength(2);
});
it("excludes non-watchlisted films without loading their details", async () => {
  const result = await digestFilms([film("other")], new Set(), [], now, async () => {
    throw new Error("should not load");
  });
  expect(result.count).toBe(0);
});
it("puts all-sold-out films and overflow in the compact list with eight cards", async () => {
  const films = [film("sold"), ...Array.from({ length: 10 }, (_, i) => film(`film-${i}`))];
  const result = await build(
    films,
    Object.fromEntries(
      films.map((f, i) => [
        f.id,
        [
          row(`2026-10-${String(5 + Math.floor(i / 3)).padStart(2, "0")}T18:20:00Z`, {
            soldOut: i === 0,
          }),
        ],
      ]),
    ),
  );
  expect(result.cards).toHaveLength(8);
  expect(result.also).toHaveLength(3);
  expect(result.also[0]!.slug).toBe("sold");
  expect(result.count).toBe(11);
  const html = digestHtml(result, venues, "https://example.com", "https://example.com/unsubscribe");
  expect(html).toContain("Also in the next ten days");
  expect(html).toContain("Sold out");
  expect(html).toContain('width="28"');
});
it("collapses three chain venues, keeps single-date claims honest and retains other venues", async () => {
  const rows = ["a", "b", "c"].flatMap((venue) => [
    row("2026-10-05T18:20:00Z", { venue, formats: ["4DX"] }),
    row("2026-10-06T18:20:00Z", { venue, formats: ["4DX"] }),
  ]);
  rows.push(row("2026-10-05T19:00:00Z"));
  const result = await build([film("a")], { a: rows });
  const lines = screeningLines(result.cards[0]!, venues);
  expect(lines).toHaveLength(2);
  expect(lines[0]!.label).toContain("Daily (Mon 5–Tue 6) · 3 Cineworld cinemas");
  expect(lines[0]!.count).toBe(6);
  expect(lines[0]!.formats).toEqual(["4DX"]);
  const single = { ...result.cards[0]!, screenings: rows.filter((r) => r.time === rows[0]!.time) };
  expect(screeningLines(single, venues)[0]!.label).not.toContain("Daily");
});
it("shows four lines, remaining count, flags, metadata and escapes all untrusted content", async () => {
  const f = { ...film("a"), ti: '<script>"& film', di: [{ id: "d", name: "D & D" }] };
  const rows = Array.from({ length: 6 }, (_, i) =>
    row(`2026-10-${String(4 + i).padStart(2, "0")}T18:20:00Z`, {
      notes: '<img onerror="bad"> & ' + "long".repeat(20),
      formats: ["<4K>"],
      bookingUrl: 'javascript:alert("bad")',
    }),
  );
  const result = await build([f], { a: rows });
  const html = digestHtml(
    result,
    venues,
    "https://example.com",
    'https://example.com/unsubscribe?token="&',
  );
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img onerror");
  expect(html).not.toContain("javascript:");
  expect(html).toContain("&lt;script&gt;&quot;&amp;");
  expect(html).toContain("&lt;4K&gt;");
  expect(html).toContain("D &amp; D · 2001 · 100 min");
  expect(html).toContain("Tonight");
  expect(html).toContain("+2 more screenings");
  expect(html).toContain("/w342/poster.jpg");
  expect(html).toContain("token=&quot;&amp;");
  const tomorrow = await build([film("b")], { b: [row("2026-10-05T18:20:00Z")] });
  expect(
    digestHtml(tomorrow, venues, "https://example.com", "https://example.com/unsubscribe"),
  ).toContain("Tomorrow");
});
