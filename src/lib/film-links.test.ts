import { describe, expect, it } from "vitest";
import { filmProviderLinks } from "./film-links";

const ratings = { lb: null, im: null, mc: null, rt: null };

describe("filmProviderLinks", () => {
  it("opens the matched Letterboxd and IMDb pages", () => {
    const links = filmProviderLinks({
      ti: "Stalker",
      ye: 1979,
      ra: {
        ...ratings,
        lb: { value: 4.4, url: "https://letterboxd.com/film/stalker/" },
        im: { value: 8, url: "https://www.imdb.com/title/tt0079944/" },
      },
    });
    expect(links).toEqual([
      {
        name: "Letterboxd",
        href: "https://letterboxd.com/film/stalker/",
        label: "Open on Letterboxd",
      },
      { name: "IMDb", href: "https://www.imdb.com/title/tt0079944/", label: "Open on IMDb" },
    ]);
  });

  it("falls back to a title search when a provider page is unknown", () => {
    const links = filmProviderLinks({ ti: "Paris, Texas", ye: 1984, ra: ratings });
    expect(links).toEqual([
      {
        name: "Letterboxd",
        href: "https://letterboxd.com/search/films/Paris%2C%20Texas/",
        label: "Find on Letterboxd",
      },
      {
        name: "IMDb",
        href: "https://www.imdb.com/find/?q=Paris%2C%20Texas%201984&s=tt&ttype=ft",
        label: "Find on IMDb",
      },
    ]);
  });

  it("omits the year from the IMDb search when it is unknown", () => {
    const [, imdb] = filmProviderLinks({ ti: "Shorts", ye: null, ra: ratings });
    expect(imdb?.href).toBe("https://www.imdb.com/find/?q=Shorts&s=tt&ttype=ft");
  });

  it("searches Letterboxd with a space where the title has a slash", () => {
    const [letterboxd] = filmProviderLinks({ ti: "Face/Off", ye: 1997, ra: ratings });
    expect(letterboxd?.href).toBe("https://letterboxd.com/search/films/Face%20Off/");
  });
});
