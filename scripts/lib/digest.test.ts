import { expect, it } from "vitest";
import { digestFilms, digestText } from "./digest";
import type { Film } from "../../src/shared/data";
const film = (slug: string, screening = true) =>
  ({
    id: slug,
    ti: "An invented film",
    ye: 2001,
    ra: { lb: { url: `https://letterboxd.com/film/${slug}/`, value: 4 } },
    sc: screening ? [[0, 600, 0, 0, 0, 0]] : [],
  }) as Film;
it("only emails watchlisted screening films and waits 30 days after departure", () => {
  const now = 40 * 86400;
  expect(
    digestFilms(
      [film("new"), film("seen"), film("returned"), film("future", false), film("other")],
      new Set(["new", "seen", "returned", "future"]),
      [
        { slug: "seen", sent_at: 1, last_screening_at: 39 * 86400 },
        { slug: "returned", sent_at: 1, last_screening_at: 5 * 86400, absent_since: 6 * 86400 },
      ],
      now,
    ).map((film) => film.id),
  ).toEqual(["new", "returned"]);
  expect(
    digestText(
      [film("new")],
      "https://example.com",
      "https://example.com/unsubscribe?token=synthetic",
    ),
  ).toContain("Unsubscribe: https://example.com/unsubscribe?token=synthetic");
});
