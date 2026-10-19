import type { Film } from "../shared/data";

// Prefer the matched provider page; fall back to that provider's search for the title.
export function filmProviderLinks(film: Pick<Film, "ti" | "ye" | "ra">) {
  return [
    {
      name: "Letterboxd",
      url: film.ra.lb?.url,
      search: `https://letterboxd.com/search/films/${encodeURIComponent(film.ti)}/`,
    },
    {
      name: "IMDb",
      url: film.ra.im?.url,
      search: `https://www.imdb.com/find/?q=${encodeURIComponent(`${film.ti}${film.ye ? ` ${film.ye}` : ""}`)}&s=tt`,
    },
  ].map(({ name, url, search }) => ({
    name,
    href: url || search,
    label: url ? `Open on ${name}` : `Find on ${name}`,
  }));
}
