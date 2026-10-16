import type { DataManifest } from "@lci/core/data";
import { validateManifest, resolveDataUrl } from "@lci/core/catalogue-loader";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import type { ChangelogBundle, VersionManifest } from "@lci/core/changelog";

// Confirms a Pages deployment serves the revision and notes built in this run, then writes a
// receipt. A failure here does not mean the upload failed: the site may already be live.
const expected = JSON.parse(await readFile("dist/version.json", "utf8")) as VersionManifest;
const expectedCatalogue = JSON.parse(await readFile("dist/catalogue.json", "utf8")) as DataManifest;
const targets = (process.env.VERIFY_URLS ?? "")
  .split(/\s+/)
  .filter((url) => /^https?:\/\/[a-z0-9.:-]+$/.test(url));
if (!targets.length) throw new Error("VERIFY_URLS must list origins to check");

async function check(origin: string) {
  const read = async (path: string) => {
    const response = await fetch(`${origin}${path}?revision=${expected.revision}`, {
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`${origin}${path} returned ${response.status}`);
    return response.text();
  };
  const [versionText, content] = await Promise.all([
    read("/version.json"),
    read("/changelog.json"),
  ]);
  const catalogue = JSON.parse(await read("/catalogue.json")) as DataManifest;
  validateManifest(catalogue);
  if (
    catalogue.generatedAt !== expectedCatalogue.generatedAt ||
    catalogue.films !== expectedCatalogue.films
  )
    throw new Error(`${origin}: catalogue differs from this build`);
  await read(new URL(resolveDataUrl(origin, catalogue.films)).pathname);
  const version = JSON.parse(versionText) as VersionManifest;
  const bundle = JSON.parse(content) as ChangelogBundle;
  const problems = [
    version.revision !== expected.revision && `serves revision ${version.revision}`,
    bundle.revision !== expected.revision && `changelog built from ${bundle.revision}`,
    createHash("sha256").update(content).digest("hex") !== expected.changelogHash &&
      "changelog content differs from this build",
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
