import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import {
  changelogFragmentSchema,
  type ChangelogBundle,
  type ChangelogFragment,
  type VersionManifest,
} from "../../src/shared/changelog";

export const ENTRIES_DIR = "changelog/entries";
export const FEATURES_FILE = "changelog/features.json";

export const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** Validate fragment files; every problem is reported, not just the first. */
export function parseFragments(files: { name: string; text: string }[]) {
  const errors: string[] = [];
  const fragments: ChangelogFragment[] = [];
  const ids = new Set<string>();
  for (const { name, text } of files) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      errors.push(`${name}: not valid JSON`);
      continue;
    }
    const parsed = changelogFragmentSchema.safeParse(json);
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        errors.push(`${name}: ${issue.path.join(".") || "entry"} — ${issue.message}`);
      continue;
    }
    if (name !== `${parsed.data.id}.json`) errors.push(`${name}: filename must be <id>.json`);
    if (ids.has(parsed.data.id)) errors.push(`${name}: duplicate id ${parsed.data.id}`);
    ids.add(parsed.data.id);
    fragments.push(parsed.data);
  }
  return { fragments, errors };
}

/** Public, enabled notes newest first. Notes behind a disabled feature stay unpublished. */
export function buildBundle(
  fragments: ChangelogFragment[],
  features: Record<string, boolean>,
  added: Map<string, number>,
  revision: string,
) {
  const errors = fragments
    .filter((entry) => entry.feature && !(entry.feature in features))
    .map((entry) => `${entry.id}.json: unknown feature ${entry.feature} (see ${FEATURES_FILE})`);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" });
  const entries = fragments
    .filter((entry) => entry.visibility === "public" && (!entry.feature || features[entry.feature]))
    // Uncommitted fragments sort first so a local preview shows the note being written.
    .map((entry) => ({ entry, at: added.get(entry.id) ?? Infinity }))
    .sort((a, b) => b.at - a.at || a.entry.id.localeCompare(b.entry.id))
    .map(({ entry, at }) => ({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      body: entry.body,
      ...(entry.href ? { href: entry.href, linkLabel: entry.linkLabel } : {}),
      changeDate: Number.isFinite(at) ? day.format(new Date(at * 1000)) : null,
    }));
  const bundle: ChangelogBundle = { revision, entries };
  const content = `${JSON.stringify(bundle)}\n`;
  const version: VersionManifest = {
    revision,
    changelogHash: createHash("sha256").update(content).digest("hex"),
    entryIds: entries.map((entry) => entry.id),
  };
  return { errors, content, version };
}

/**
 * Every PR adds a fragment: a public note or an internal entry with a reviewable reason.
 * Merged fragments keep their IDs, so removing or renaming one is refused.
 */
export function checkPolicy(changes: { status: string; path: string }[]) {
  const fragment = /^changelog\/entries\/[^/]+\.json$/;
  const errors = changes
    .filter((change) => fragment.test(change.path) && /^[DR]/.test(change.status))
    .map((change) => `${change.path}: published entry IDs are stable; do not remove or rename`);
  if (!changes.some((change) => change.status === "A" && fragment.test(change.path)))
    errors.push(
      "Add a changelog fragment: `npm run changelog:new -- <id>`. Use visibility internal " +
        "with a reason when the change has no user-facing effect.",
    );
  return errors;
}

export async function readFragmentFiles(directory = ENTRIES_DIR) {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(
    names.map(async (name) => ({ name, text: await readFile(`${directory}/${name}`, "utf8") })),
  );
}

/** Commit time (unix seconds) that first added each fragment; full history required. */
export function fragmentAddedTimes(directory = ENTRIES_DIR) {
  if (git("rev-parse", "--is-shallow-repository") === "true")
    throw new Error("Changelog dates need full git history (actions/checkout fetch-depth: 0)");
  const log = git("log", "--diff-filter=A", "--name-only", "--format=@%ct", "--", directory);
  const added = new Map<string, number>();
  let time = 0;
  for (const line of log.split("\n")) {
    if (line.startsWith("@")) time = Number(line.slice(1));
    else if (line.endsWith(".json")) added.set(line.slice(directory.length + 1, -5), time);
  }
  return added;
}
