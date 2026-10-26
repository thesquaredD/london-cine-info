import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { load } from "cheerio";
import { PUBLIC_PAGES, OTHER_PATHS, pageMetadata } from "../src/shared/seo";
import { filmPath } from "../src/lib/sharing";
import type { DataManifest, Film, FilmShowtimes } from "../src/shared/data";

// Inspect the actual deployment output, without executing JavaScript or using a browser.
const root = resolve("dist");
const manifest: DataManifest = JSON.parse(await readFile("src/generated/manifest.json", "utf8"));
const films: Film[] = JSON.parse(await readFile(resolve(root, manifest.films.slice(1)), "utf8"));
const xml = load(await readFile(resolve(root, "sitemap.xml"), "utf8"), { xmlMode: true });
const urls = xml("loc")
  .map((_i, node) => xml(node).text())
  .get();
assert.equal(
  new Set(urls).size,
  PUBLIC_PAGES.length + films.length,
  "Sitemap must contain unique public URLs",
);
const origin = new URL(urls[0]!).origin;
const robots = await readFile(resolve(root, "robots.txt"), "utf8");
assert(robots.includes(`Sitemap: ${origin}/sitemap.xml`));

for (const path of [
  ...PUBLIC_PAGES.map(({ path }) => path),
  ...OTHER_PATHS,
  ...films.map(filmPath),
]) {
  const film = films.find((film) => filmPath(film) === path);
  const file =
    path === "/" ? "index.html" : film ? `${path.slice(1)}index.html` : `${path.slice(1)}.html`;
  const $ = load(await readFile(resolve(root, file), "utf8"));
  const meta = pageMetadata(path, film, origin);
  assert.equal($("title").text(), meta.title, file);
  for (const selector of [
    'meta[name="description"]',
    'link[rel="canonical"]',
    'meta[name="robots"]',
  ]) {
    assert.equal($(selector).length, 1, `${file}: ${selector}`);
  }
  assert.equal($('link[rel="canonical"]').attr("href"), meta.url, file);
  assert.equal($('meta[property="og:url"]').attr("content"), meta.url, file);
  assert.equal($('meta[name="robots"]').attr("content")?.includes("noindex"), meta.noindex, file);
  if (!meta.noindex) assert.deepEqual(JSON.parse($("#seo-data").text()), meta.structuredData, file);
  else assert.equal($("#seo-data").length, 0, file);
  if (film) {
    assert(urls.includes(meta.url), file);
    const showtimes: FilmShowtimes = JSON.parse(
      await readFile(resolve(root, `${manifest.showtimes.slice(1)}${film.id}.json`), "utf8"),
    );
    assert.equal(
      $("#discovery-screenings").parent().find("li").length,
      Object.values(showtimes.days).flat().length,
      file,
    );
  }
}

const home = load(await readFile(resolve(root, "index.html"), "utf8"));
assert.equal(home("#discovery-films").parent().find('a[href^="/film/"]').length, films.length);
const missing = load(await readFile(resolve(root, "film/404.html"), "utf8"));
assert.equal(missing('meta[name="robots"]').attr("content"), "noindex, follow");
assert.equal(missing("#seo-data").length, 0);
assert.equal(missing('script[type="module"]').length, 1, "Old film links must remain recoverable");

// Include every generated/static asset in the hosting limits, not just the film count.
const files = await readdir(root, { recursive: true });
let count = 0;
for (const file of files) {
  const info = await stat(resolve(root, file));
  if (!info.isFile()) continue;
  count++;
  assert(info.size <= 25 * 1024 * 1024, `${file} exceeds the Pages 25 MiB file limit`);
}
assert(count <= 20_000, `${count} files exceed the Pages 20,000-file limit`);
console.log(
  `Search output verified: ${urls.length} sitemap URLs, ${films.length} readable film programmes, ${count} deployment files.`,
);
