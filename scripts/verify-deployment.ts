import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import type { ChangelogBundle, VersionManifest } from "@readograph/core/changelog";
import { parseManifest } from "@readograph/core/catalogue-loader";

// Confirms a Pages deployment serves the revision and notes built in this run, then writes a
// receipt. A failure here does not mean the upload failed: the site may already be live.
const expected = JSON.parse(await readFile("dist/version.json", "utf8")) as VersionManifest;
const targets = (process.env.VERIFY_URLS ?? "")
  .split(/\s+/)
  .filter((url) => /^https?:\/\/[a-z0-9.:-]+$/.test(url));
if (!targets.length) throw new Error("VERIFY_URLS must list origins to check");

// One built film page: link previews depend on Pages serving these static entries rather
// than the generic app shell.
const ogTitle = (html: string) =>
  /<meta property="og:title" content="([^"]*)"/.exec(html)?.[1] ?? null;
const filmId = (await readdir("dist/film", { withFileTypes: true })).find((entry) =>
  entry.isDirectory(),
)?.name;
const [slug] = filmId ? await readdir(`dist/film/${filmId}`) : [];
const filmPage = {
  path: `/film/${filmId}/${slug}/`,
  title: slug ? ogTitle(await readFile(`dist/film/${filmId}/${slug}/index.html`, "utf8")) : null,
};
if (!filmPage.title) throw new Error("dist/film has no film page with og:title to verify");
const searchAssets = await Promise.all(
  ["/robots.txt", "/sitemap.xml"].map(async (path) => ({
    path,
    content: await readFile(`dist${path}`, "utf8"),
  })),
);

// The public catalogue manifest: the app reads it to find the current data files, so it must
// name this build's files, and each must be served the moment the deploy is live.
const catalogue = parseManifest(JSON.parse(await readFile("dist/catalogue.json", "utf8")));
const showtimeFile = (await readdir(`dist${catalogue.showtimes}`)).find((name) =>
  name.endsWith(".json"),
);
if (!showtimeFile) throw new Error(`dist${catalogue.showtimes} has no showtime file to verify`);
// Compared by content: Pages answers a missing file with the app shell and HTTP 200.
const catalogueFiles = await Promise.all(
  [catalogue.films, catalogue.meta, catalogue.events, `${catalogue.showtimes}${showtimeFile}`].map(
    async (path) => ({ path, content: await readFile(`dist${path}`, "utf8") }),
  ),
);

async function check(origin: string) {
  const request = async (path: string) => {
    const response = await fetch(`${origin}${path}?revision=${expected.revision}`, {
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`${origin}${path} returned ${response.status}`);
    return response;
  };
  const read = async (path: string) => (await request(path)).text();
  const [versionText, content, filmHtml, catalogueResponse] = await Promise.all([
    read("/version.json"),
    read("/changelog.json"),
    read(filmPage.path),
    request("/catalogue.json"),
  ]);
  // The app must see a new manifest as soon as a deploy lands, so no cache may keep the old one.
  if (!/\bno-cache\b/.test(catalogueResponse.headers.get("Cache-Control") ?? ""))
    throw new Error(`${origin}/catalogue.json is not served with Cache-Control: no-cache`);
  const served = parseManifest(await catalogueResponse.json());
  if (served.generatedAt !== catalogue.generatedAt || served.films !== catalogue.films)
    throw new Error(
      `${origin}/catalogue.json serves data generated at ${served.generatedAt}, not ${catalogue.generatedAt}`,
    );
  for (const file of catalogueFiles) {
    if ((await read(file.path)) !== file.content)
      throw new Error(`${origin}${file.path} does not serve this build's data file`);
  }
  // These paths used to return the generic SPA HTML with a misleading 200 status.
  for (const asset of searchAssets) {
    if ((await read(asset.path)) !== asset.content)
      throw new Error(`${origin}${asset.path} does not serve this build's search asset`);
  }
  const version = JSON.parse(versionText) as VersionManifest;
  const bundle = JSON.parse(content) as ChangelogBundle;
  const problems = [
    version.revision !== expected.revision && `serves revision ${version.revision}`,
    bundle.revision !== expected.revision && `changelog built from ${bundle.revision}`,
    createHash("sha256").update(content).digest("hex") !== expected.changelogHash &&
      "changelog content differs from this build",
    ogTitle(filmHtml) !== filmPage.title &&
      `${filmPage.path} does not serve its link-preview title`,
    !filmHtml.includes('id="discovery-screenings"') &&
      `${filmPage.path} does not serve its readable programme`,
  ].filter(Boolean);
  if (problems.length) throw new Error(`${origin}: ${problems.join("; ")}`);
}

// Production can take a moment to switch to a new deployment.
for (const origin of targets) {
  for (let attempt = 1; ; attempt++) {
    try {
      await check(origin);
      console.log(`✓ ${origin} serves ${expected.revision}`);
      break;
    } catch (error) {
      if (attempt === 12)
        throw new Error(
          `${(error as Error).message}. The deployment may already be live; do not mark linked ` +
            "issues released until this check passes.",
        );
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }
}

const receipt = {
  sha: expected.revision,
  deploymentId: process.env.DEPLOYMENT_ID ?? null,
  deploymentUrl: process.env.DEPLOYMENT_URL ?? null,
  verified: targets,
  verifiedAt: new Date().toISOString(),
  entryIds: expected.entryIds,
  workflowRun: process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null,
};
await writeFile("deployment-receipt.json", `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
