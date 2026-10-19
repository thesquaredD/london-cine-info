import type { Film } from "../../src/shared/data";
import { filmPath } from "../../src/lib/sharing";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );

// Link-preview crawlers do not resolve relative image URLs, so only an absolute https poster
// is offered; anything else falls back to a text-only card.
function absolutePoster(poster: string | null | undefined) {
  if (!poster) return null;
  try {
    return new URL(poster).protocol === "https:" ? poster : null;
  } catch {
    return null;
  }
}

export function filmPage(html: string, film: Pick<Film, "ti" | "ye" | "po">): string {
  const title = escape(`${film.ti}${film.ye ? ` (${film.ye})` : ""} — London Ciné Info`);
  const description = escape(
    `Find London cinema screenings for ${film.ti}, choose a showing and book with the cinema.`,
  );
  const poster = absolutePoster(film.po);
  const meta = [
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="London Ciné Info" />`,
    `<meta name="twitter:card" content="${poster ? "summary_large_image" : "summary"}" />`,
    ...(poster ? [`<meta property="og:image" content="${escape(poster)}" />`] : []),
  ];
  return html
    .replace(/<title>.*?<\/title>/s, () => `<title>${title}</title>`)
    .replace(
      /<meta name="description"[^>]*>/,
      () => `<meta name="description" content="${description}" />`,
    )
    .replace("</head>", () => `  ${meta.join("\n    ")}\n  </head>`);
}

/**
 * Static HTML per film gives messaging crawlers the film title without running JavaScript.
 * The page is the built index.html with film-specific metadata, so the same app boots and
 * reads the film from the URL.
 */
export function filmPages(): Plugin {
  let root = process.cwd();
  return {
    name: "film-share-pages",
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
        const manifest = JSON.parse(
          await readFile(resolve(root, "src/generated/manifest.json"), "utf8"),
        );
        const films: Film[] = JSON.parse(
          await readFile(resolve(root, `public${manifest.films}`), "utf8"),
        );
        for (const film of films) {
          this.emitFile({
            type: "asset",
            fileName: `${filmPath(film).slice(1)}index.html`,
            source: filmPage(String(index.source), film),
          });
        }
      },
    },
  };
}
