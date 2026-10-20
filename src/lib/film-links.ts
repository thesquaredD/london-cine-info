import type { Film } from "../shared/data";

// Prefer the matched provider page; fall back to that provider's search for the title.
export function filmProviderLinks(film: Pick<Film, "ti" | "ye" | "ra">) {
  return [
    {
      key: "letterboxd" as const,
      name: "Letterboxd",
      url: film.ra.lb?.url,
      // A "/" (Face/Off) would end the path segment even when encoded, so search with a space.
      search: `https://letterboxd.com/search/films/${encodeURIComponent(film.ti.replaceAll("/", " "))}/`,
    },
    {
      key: "imdb" as const,
      name: "IMDb",
      url: film.ra.im?.url,
      search: `https://www.imdb.com/find/?q=${encodeURIComponent(`${film.ti}${film.ye ? ` ${film.ye}` : ""}`)}&s=tt&ttype=ft`,
    },
  ].map(({ key, name, url, search }) => ({
    key,
    name,
    href: url || search,
    label: url ? `Open on ${name}` : `Find on ${name}`,
  }));
}
