import type { Film } from "./data";
import { SITE_HOST } from "./analytics";
import { filmPath } from "../lib/sharing";

export const SITE_NAME = "London Ciné Info";
export const DEFAULT_ORIGIN = `https://${SITE_HOST}`;
export const PUBLIC_PAGES = [
  {
    path: "/",
    name: "London cinema listings and showtimes",
    description:
      "Find cinema screenings across London. Browse films, compare showtimes and follow cinema links to book, with filters for dates, venues and formats.",
    catalogue: true,
  },
  {
    path: "/new",
    name: "New films in London cinemas",
    description:
      "Browse new films with London cinema screenings and booking links. New releases use original release dates, which may differ from UK release dates.",
    catalogue: true,
  },
  {
    path: "/classics",
    name: "Classic films in London cinemas",
    description:
      "Find classic films returning to London cinema screens. Compare showtimes, venues and formats, then book directly with the cinema.",
    catalogue: true,
  },
  {
    path: "/retrospectives",
    name: "Film retrospectives in London",
    description:
      "Explore directors with several films in the London programme. Find retrospective screenings, cinema details and booking links.",
    catalogue: true,
  },
  {
    path: "/events",
    name: "London cinema events and special screenings",
    description:
      "Find London cinema Q&As, introductions, live scores and other special screenings, with dates, venues and links to book.",
    catalogue: true,
  },
  {
    path: "/calendar",
    name: "Film release calendar for London cinema listings",
    description:
      "Browse upcoming films in the London programme by original release date. Dates come from TMDB and are not confirmed UK cinema release dates.",
    catalogue: true,
  },
  {
    path: "/radar",
    name: "London film Radar: limited screenings, 35mm, 70mm and IMAX",
    description:
      "Find films with a few listed screenings and films showing in 35mm, 70mm or IMAX across London. Availability reflects the latest programme snapshot.",
    catalogue: true,
  },
  {
    path: "/about",
    name: "About London Ciné Info and its sources",
    description:
      "How London Ciné Info brings together cinema screenings using Clusterflick data, with source releases, programme freshness and coverage limitations.",
    catalogue: false,
  },
] as const;

const OTHER_PAGES: Record<string, { name: string; description: string; noindex?: boolean }> = {
  "/how-to-use": {
    name: "How to use London Ciné Info",
    description:
      "Learn how to find films, choose a screening, book with a cinema and use watchlists, friends and favourite cinemas.",
  },
  "/privacy": {
    name: "Privacy",
    description:
      "How London Ciné Info handles browsing, account information, watchlists and optional analytics.",
  },
  "/changelog": {
    name: "What’s new",
    description: "Read about changes to London Ciné Info and its cinema listings tools.",
  },
  "/watchlist": {
    name: "Your watchlist",
    description: "Find London screenings for films on your watchlist.",
    noindex: true,
  },
  "/my-calendar": {
    name: "Your cinema calendar",
    description: "Your saved cinema screenings.",
    noindex: true,
  },
  "/account": {
    name: "Account",
    description: "Manage your London Ciné Info account.",
    noindex: true,
  },
  "/friends": {
    name: "Friends",
    description: "Compare watchlists and choose a film together.",
    noindex: true,
  },
  "/settings": {
    name: "Settings",
    description: "Choose how London Ciné Info displays films.",
    noindex: true,
  },
  "/auth/verify": { name: "Sign in", description: "Sign in to London Ciné Info.", noindex: true },
  "/unsubscribe": {
    name: "Email preferences",
    description: "Manage cinema email preferences.",
    noindex: true,
  },
};
export const OTHER_PATHS = [...Object.keys(OTHER_PAGES), "/welcome"];
export type PreviewFilm = Pick<Film, "id" | "ti" | "ye" | "po"> & Partial<Film>;
export type PageMetadata = {
  title: string;
  description: string;
  url: string;
  noindex: boolean;
  image: string | null;
  imageAlt: string;
  structuredData: object;
};

export function absolutePoster(poster: string | null | undefined) {
  if (!poster) return null;
  try {
    return new URL(poster).protocol === "https:" ? poster : null;
  } catch {
    return null;
  }
}

export function pageMetadata(
  path: string,
  film?: PreviewFilm,
  origin = DEFAULT_ORIGIN,
): PageMetadata {
  path = path.split(/[?#]/)[0]!.replace(/\/$/, "") || "/";
  const page =
    PUBLIC_PAGES.find((page) => page.path === (path === "/welcome" ? "/" : path)) ??
    OTHER_PAGES[path];
  const title = film
    ? `${film.ti}${film.ye ? ` (${film.ye})` : ""}`
    : (page?.name ?? (path.startsWith("/film/") ? "Film link unavailable" : "Page not found"));
  const description = film
    ? `Find London cinema screenings for ${film.ti}, choose a showing and book with the cinema.`
    : (page?.description ??
      (path.startsWith("/film/")
        ? "This film link has no page in the current programme. Browse current films, or enable JavaScript to check whether its address has changed."
        : "Browse the current London cinema programme to find a film or screening."));
  const url = new URL(film ? filmPath(film) : path === "/welcome" ? "/" : path, origin).href;
  const noindex = !film && (!page || ("noindex" in page && !!page.noindex));
  const image = film ? absolutePoster(film.po) : null;
  const website = {
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: SITE_NAME,
    url: `${origin}/`,
    inLanguage: "en-GB",
  };
  const webpage = {
    "@type":
      path === "/about"
        ? "AboutPage"
        : !film && page && "catalogue" in page && page.catalogue
          ? "CollectionPage"
          : "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: `${title} — ${SITE_NAME}`,
    description,
    inLanguage: "en-GB",
    isPartOf: { "@id": website["@id"] },
    ...(film ? { mainEntity: { "@id": `${url}#movie` } } : {}),
  };
  const movie = film
    ? {
        "@type": "Movie",
        "@id": `${url}#movie`,
        name: film.ti,
        url,
        ...(image ? { image } : {}),
        ...(film.o_ti ? { alternateName: film.o_ti } : {}),
        ...(film.di?.length
          ? { director: film.di.map(({ name }) => ({ "@type": "Person", name })) }
          : {}),
        ...(film.ru && film.ru > 0 ? { duration: `PT${film.ru}M` } : {}),
        ...(film.rd ? { datePublished: film.rd } : {}),
      }
    : null;
  return {
    title: `${title} — ${SITE_NAME}`,
    description,
    url,
    noindex,
    image,
    imageAlt: film ? `${film.ti} poster` : "",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [website, webpage, ...(movie ? [movie] : [])],
    },
  };
}

export function metadataElements(meta: PageMetadata) {
  return [
    { tag: "meta", attrs: { name: "description", content: meta.description } },
    { tag: "link", attrs: { rel: "canonical", href: meta.url } },
    {
      tag: "meta",
      attrs: {
        name: "robots",
        content: meta.noindex ? "noindex, follow" : "index, follow, max-image-preview:large",
      },
    },
    ...Object.entries({
      url: meta.url,
      title: meta.title,
      description: meta.description,
      type: "website",
      site_name: SITE_NAME,
      locale: "en_GB",
      ...(meta.image ? { image: meta.image, "image:alt": meta.imageAlt } : {}),
    }).map(([key, content]) => ({ tag: "meta", attrs: { property: `og:${key}`, content } })),
    { tag: "meta", attrs: { name: "twitter:card", content: "summary" } },
  ];
}
