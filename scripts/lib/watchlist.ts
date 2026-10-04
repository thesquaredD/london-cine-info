import { load } from "cheerio";
export type WatchlistPage = { slugs: string[]; count: number; pages: number };
export function parseWatchlist(html: string): WatchlistPage {
  const $ = load(html);
  const countText = $(".js-watchlist-count").first().text().replaceAll(",", "").trim();
  const count = Number.parseInt(countText, 10);
  if (!/^\d+\b/.test(countText) || !Number.isSafeInteger(count) || count < 0)
    throw new Error("Watchlist is private, unavailable, or its markup has changed");
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
    throw new Error("Watchlist could not be read completely");
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
      throw new Error("Watchlist changed during refresh; please try later");
    for (const slug of next.slugs) {
      if (all.has(slug)) throw new Error("Watchlist pagination repeated a film");
      all.add(slug);
    }
  }
  if (all.size !== first.count) throw new Error("Watchlist count did not match the imported films");
  return { slugs: [...all].sort(), count: first.count };
}
let nextRequestAt = 0;
export async function politeGet(url: string): Promise<string> {
  const delay = nextRequestAt - Date.now();
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  nextRequestAt = Date.now() + 1000;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "London-Cine-Info/2.0 (+https://london-cine.info/about; public watchlist sync)",
    },
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Letterboxd unavailable (${response.status})`);
  const html = await response.text();
  if (html.length > 5_000_000) throw new Error("Watchlist page too large");
  return html;
}
