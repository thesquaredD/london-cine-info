import { readFile } from "node:fs/promises";
import { beforeAll, expect, it } from "vitest";
import { load } from "cheerio";
import { h } from "preact";
import render from "preact-render-to-string";
import { buildDataset, type Dataset } from "./transform";
import { loadBoroughs } from "./boroughs";
import { filmPage, metadataPage, robots, sitemap } from "./film-pages";
import { DiscoveryPage } from "../../src/components/discovery-page";
import { About } from "../../src/components/about";
import { OTHER_PATHS, PUBLIC_PAGES, pageMetadata } from "../../src/shared/seo";
import { filmPath } from "../../src/lib/sharing";

const template =
  '<html><head><title>Original</title><meta name="description" content="original"></head><body></body></html>';
let dataset: Dataset;
beforeAll(async () => {
  const fixture = JSON.parse(
    await readFile(new URL("../../tests/fixtures/pipeline.json", import.meta.url), "utf8"),
  );
  dataset = buildDataset(fixture.combined, fixture.matched, {
    now: new Date(fixture.now),
    sources: fixture.sources,
    boroughs: await loadBoroughs(),
  });
});

it("exposes every current film through ordinary links and keeps categories accurate", () => {
  for (const path of ["/", "/new", "/classics", "/retrospectives", "/events", "/calendar"]) {
    const $ = load(render(h(DiscoveryPage, { path, films: dataset.films, meta: dataset.meta })));
    const ids = $("#discovery-films")
      .parent()
      .find("a")
      .map((_i, node) => $(node).attr("href"))
      .get();
    const expected = dataset.films.filter(
      (film) =>
        path === "/" ||
        (path === "/new" && film.new) ||
        (path === "/classics" && film.classic) ||
        (path === "/retrospectives" && film.retro.length > 0) ||
        (path === "/events" && film.event) ||
        (path === "/calendar" && film.upcoming),
    );
    expect(ids.sort()).toEqual(expected.map(filmPath).sort());
    expect($("time[datetime]").last().attr("datetime")).toBe(dataset.meta.generatedAt);
    expect($("h1")).toHaveLength(1);
  }
});

it("renders venue names, exact times, booking destinations and source caveats without JavaScript", () => {
  const film = dataset.films.find(({ id }) => id === "classic-a")!;
  const showtimes = dataset.showtimes.find(({ id }) => id === film.id)!;
  const $ = load(
    render(
      h(DiscoveryPage, {
        path: filmPath(film),
        films: dataset.films,
        meta: dataset.meta,
        film,
        showtimes,
      }),
    ),
  );
  const rows = Object.values(showtimes.days).flat();
  expect($("#discovery-screenings").parent().find("li")).toHaveLength(rows.length);
  for (const row of rows) {
    expect($(`time[datetime="${new Date(row.time).toISOString()}"]`)).toHaveLength(1);
    expect(
      $("a")
        .toArray()
        .some((node) => $(node).attr("href") === row.bookingUrl),
    ).toBe(true);
    expect($("body").text()).toContain(
      dataset.meta.venues.find(({ id }) => id === row.venue)!.name,
    );
  }
  expect($("body").text()).toContain("London time");
  expect($("body").text()).toContain("Listings may be incomplete");
  expect($("body").text()).toContain("Sold out");
});

it("uses the actual About component and identifies the upstream source releases", () => {
  const $ = load(render(h(About, { meta: dataset.meta, onNavigate: () => {} })));
  expect($("body").text()).toContain("do not carry an explicit licence");
  for (const source of Object.values(dataset.meta.sources)) {
    expect(
      $("a")
        .toArray()
        .some(
          (node) =>
            $(node).attr("href") ===
            `https://github.com/${source.repository}/releases/tag/${source.tag}`,
        ),
    ).toBe(true);
  }
});

it("keeps canonical URLs, social metadata and the sitemap on the configured origin", () => {
  const origin = "https://preview.example";
  const xml = load(sitemap(dataset.films, dataset.meta.generatedAt, origin), { xmlMode: true });
  const urls = xml("loc")
    .map((_i, node) => xml(node).text())
    .get();
  expect(new Set(urls).size).toBe(PUBLIC_PAGES.length + dataset.films.length);
  expect(urls.every((url) => url.startsWith(origin) && !url.includes("?"))).toBe(true);
  expect(urls).not.toContain(`${origin}/account`);
  for (const page of PUBLIC_PAGES) {
    const $ = load(
      metadataPage(template, pageMetadata(`${page.path}?q=private`, undefined, origin)),
    );
    expect($("title")).toHaveLength(1);
    expect($('meta[name="description"]')).toHaveLength(1);
    expect($('link[rel="canonical"]').attr("href")).toBe(`${origin}${page.path}`);
    expect($('meta[property="og:url"]').attr("content")).toBe(`${origin}${page.path}`);
    expect($('meta[name="robots"]').attr("content")).toContain("index, follow");
  }
  expect(robots(origin)).toContain(`Sitemap: ${origin}/sitemap.xml`);
  expect(robots(origin)).toContain("Disallow: /api/");
  expect(robots(origin)).not.toContain("Disallow: /data/");
});

it("marks account and unknown pages noindex without publishing their query parameters", () => {
  for (const path of [
    ...OTHER_PATHS.filter(
      (path) => !["/privacy", "/how-to-use", "/changelog", "/welcome"].includes(path),
    ),
    "/missing",
    "/film/expired/title/",
  ]) {
    const meta = pageMetadata(`${path}?token=secret&friend=someone`);
    const $ = load(metadataPage(template, meta));
    expect($('meta[name="robots"]').attr("content")).toBe("noindex, follow");
    expect($("#seo-data")).toHaveLength(0);
    expect(meta.url).not.toContain("secret");
  }
  expect(pageMetadata("/welcome").url).toBe("https://london-cine.info/");
});

it("escapes imported content in HTML and JSON-LD and uses factual film fields only", () => {
  const film = { ...dataset.films[0]!, ti: '</script><img src=x onerror="alert(1)"> & $1' };
  const $ = load(filmPage(template, film));
  expect($("script")).toHaveLength(1);
  expect($("img")).toHaveLength(0);
  const graph = JSON.parse($("#seo-data").text())["@graph"];
  const movie = graph.find((entry: { "@type": string }) => entry["@type"] === "Movie");
  expect(movie.name).toBe(film.ti);
  expect(movie.aggregateRating).toBeUndefined();
  expect(movie.offers).toBeUndefined();
  expect(movie.url).toBe(pageMetadata(filmPath(film), film).url);
  const showtimes = {
    ...dataset.showtimes[0]!,
    details: { actors: [], overview: "<script>alert(1)</script>" },
  };
  const body = load(
    render(
      h(DiscoveryPage, {
        path: filmPath(film),
        films: dataset.films,
        meta: dataset.meta,
        film,
        showtimes,
      }),
    ),
  );
  expect(body("script, img")).toHaveLength(0);
  expect(body("h1").text()).toContain(film.ti);
  expect(body("body").text()).toContain(showtimes.details.overview);
});
