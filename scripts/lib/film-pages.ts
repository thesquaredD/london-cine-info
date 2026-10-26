import type { DataManifest, DataMeta, Film, FilmShowtimes } from "../../src/shared/data";
import { filmPath } from "../../src/lib/sharing";
import {
  DEFAULT_ORIGIN,
  PUBLIC_PAGES,
  OTHER_PATHS,
  metadataElements,
  pageMetadata,
  type PageMetadata,
  type PreviewFilm,
} from "../../src/shared/seo";
import { About } from "../../src/components/about";
import { DiscoveryPage } from "../../src/components/discovery-page";
import { h } from "preact";
import render from "preact-render-to-string";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

export const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );

export const SITE_ORIGIN = new URL(process.env.SITE_URL || DEFAULT_ORIGIN).origin;
if (!/^https?:$/.test(new URL(SITE_ORIGIN).protocol))
  throw new Error("SITE_URL must use HTTP or HTTPS");

export function metadataPage(html: string, meta: PageMetadata): string {
  const tags = metadataElements(meta).map(
    ({ tag, attrs }) =>
      `<${tag} ${Object.entries(attrs)
        .map(([key, value]) => `${key}="${escape(value)}"`)
        .join(" ")} />`,
  );
  if (!meta.noindex)
    tags.push(
      `<script id="seo-data" type="application/ld+json">${JSON.stringify(meta.structuredData).replace(/</g, "\\u003c")}</script>`,
    );
  return html
    .replace(/<title>.*?<\/title>/s, () => `<title>${escape(meta.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, "")
    .replace("</head>", () => `${tags.join("\n    ")}\n  </head>`);
}

export function filmPage(html: string, film: PreviewFilm, origin = SITE_ORIGIN): string {
  return metadataPage(html, pageMetadata(filmPath(film), film, origin));
}

export function sitemap(films: Film[], generatedAt: string, origin = SITE_ORIGIN): string {
  const urls = [
    ...PUBLIC_PAGES.map(({ path }) => new URL(path, origin).href),
    ...films.map((film) => new URL(filmPath(film), origin).href),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `<url><loc>${escape(url)}</loc><lastmod>${escape(generatedAt)}</lastmod></url>`).join("\n")}\n</urlset>\n`;
}

export function robots(origin = SITE_ORIGIN): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`;
}

/** Public HTML is generated from the exact dataset shipped with the interactive app. */
export function filmPages(): Plugin {
  let root = process.cwd();
  return {
    name: "search-discovery-pages",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      root = config.root;
    },
    generateBundle: {
      order: "post",
      async handler(_options, bundle) {
        const index = bundle["index.html"];
        if (!index || index.type !== "asset") throw new Error("Missing built index.html");
        const template = String(index.source);
        const manifest: DataManifest = JSON.parse(
          await readFile(resolve(root, "src/generated/manifest.json"), "utf8"),
        );
        const [films, meta]: [Film[], DataMeta] = await Promise.all([
          readFile(resolve(root, `public${manifest.films}`), "utf8").then(JSON.parse),
          readFile(resolve(root, `public${manifest.meta}`), "utf8").then(JSON.parse),
        ]);
        const contentPage = (html: string, content: string) =>
          html.replace(
            '<div id="app"></div>',
            () => `<div id="static-content">${content}</div>\n    <div id="app"></div>`,
          );
        for (const path of [...PUBLIC_PAGES.map(({ path }) => path), ...OTHER_PATHS]) {
          const body =
            path === "/about"
              ? render(h(About, { meta, onNavigate: () => {}, standalone: true }))
              : render(h(DiscoveryPage, { path: path === "/welcome" ? "/" : path, films, meta }));
          const html = contentPage(
            metadataPage(template, pageMetadata(path, undefined, SITE_ORIGIN)),
            body,
          );
          if (path === "/") index.source = html;
          else this.emitFile({ type: "asset", fileName: `${path.slice(1)}.html`, source: html });
        }
        for (const film of films) {
          const showtimes: FilmShowtimes = JSON.parse(
            await readFile(resolve(root, `public${manifest.showtimes}${film.id}.json`), "utf8"),
          );
          this.emitFile({
            type: "asset",
            fileName: `${filmPath(film).slice(1)}index.html`,
            source: contentPage(
              filmPage(template, film),
              render(h(DiscoveryPage, { path: filmPath(film), films, meta, film, showtimes })),
            ),
          });
        }
        // Pages serves the nearest scoped 404 for an absent film page. Keep the app
        // bootable so older/mistyped slugs for a known film can still recover in-browser.
        // A scoped file preserves the root SPA fallback for other existing app routes.
        this.emitFile({
          type: "asset",
          fileName: "film/404.html",
          source: contentPage(
            metadataPage(template, pageMetadata("/film/404", undefined, SITE_ORIGIN)),
            render(h(DiscoveryPage, { path: "/film/404", films, meta })),
          ),
        });
        this.emitFile({
          type: "asset",
          fileName: "sitemap.xml",
          source: sitemap(films, meta.generatedAt),
        });
        this.emitFile({ type: "asset", fileName: "robots.txt", source: robots() });
      },
    },
  };
}
