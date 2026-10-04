import type { ImportErrorCode } from "../../src/shared/account";
export class WatchlistError extends Error {
  constructor(
    public code: ImportErrorCode,
    message: string,
  ) {
    super(message);
  }
}
import { load } from "cheerio";
export type WatchlistPage = { slugs: string[]; count: number; pages: number };
export function parseWatchlist(html: string): WatchlistPage {
  const $ = load(html);
  const countText = $(".js-watchlist-count").first().text().replaceAll(",", "").trim();
  const count = Number.parseInt(countText, 10);
  if (!/^\d+\b/.test(countText) || !Number.isSafeInteger(count) || count < 0)
    throw new WatchlistError(
      "inaccessible",
      "Watchlist is private, unavailable, or its markup has changed",
    );
  const slugs = [
    ...new Set(
      $("[data-item-slug][data-target-link]")
        .toArray()
        .map((el) => {
          const slug = $(el).attr("data-item-slug")!;
          return /^[a-z0-9-]+$/.test(slug) && $(el).attr("data-target-link") === `/film/${slug}/`
            ? slug
            : null;
        })
        .filter((value): value is string => !!value),
    ),
  ];
  const pages = Math.max(
    1,
    ...$(".paginate-page")
      .toArray()
      .map((el) => Number.parseInt($(el).text(), 10))
      .filter(Number.isFinite),
  );
  if (
    (count > 0 && !slugs.length) ||
    pages > 500 ||
    count > 14000 ||
    slugs.length > count ||
    (count === 0 && pages !== 1)
  )
    throw new WatchlistError("incomplete", "Watchlist could not be read completely");
  return { slugs, count, pages };
}
export async function fetchWatchlist(
  username: string,
  get: (url: string) => Promise<string>,
): Promise<{ slugs: string[]; count: number }> {
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(username)) throw new Error("Invalid Letterboxd username");
  const first = parseWatchlist(
    await get(`https://letterboxd.com/${encodeURIComponent(username)}/watchlist/`),
  );
  const all = new Set(first.slugs);
  for (let page = 2; page <= first.pages; page++) {
    const next = parseWatchlist(
      await get(`https://letterboxd.com/${encodeURIComponent(username)}/watchlist/page/${page}/`),
    );
    if (next.count !== first.count || next.pages !== first.pages || !next.slugs.length)
      throw new WatchlistError("incomplete", "Watchlist changed during refresh; please try later");
    for (const slug of next.slugs) {
      if (all.has(slug))
        throw new WatchlistError("incomplete", "Watchlist pagination repeated a film");
      all.add(slug);
    }
  }
  if (all.size !== first.count)
    throw new WatchlistError("incomplete", "Watchlist count did not match the imported films");
  return { slugs: [...all].sort(), count: first.count };
}
let nextRequestAt = 0;
export async function politeGet(url: string): Promise<string> {
  const delay = nextRequestAt - Date.now();
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  nextRequestAt = Date.now() + 1000;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          "London-Cine-Info/2.0 (+https://london-cine.info/about; public watchlist sync)",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new WatchlistError("unavailable", "Letterboxd could not be reached");
  }
  if (!response.ok)
    throw new WatchlistError(
      response.status === 404
        ? "not_found"
        : response.status === 401
          ? "inaccessible"
          : "unavailable",
      "Letterboxd could not be read",
    );
  let html: string;
  try {
    html = await response.text();
  } catch {
    throw new WatchlistError("unavailable", "Letterboxd response interrupted");
  }
  if (html.length > 5_000_000) throw new WatchlistError("incomplete", "Watchlist page too large");
  return html;
}
