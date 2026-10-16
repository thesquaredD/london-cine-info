import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  ENTRIES_DIR,
  FEATURES_FILE,
  buildBundle,
  checkPolicy,
  fragmentAddedTimes,
  git,
  parseFragments,
  readFragmentFiles,
} from "./lib/changelog";
import { CHANGELOG_ID } from "@lci/core/changelog";

const [command, arg] = process.argv.slice(2);

function fail(errors: string[]) {
  if (!errors.length) return;
  console.error(errors.map((error) => `✗ ${error}`).join("\n"));
  process.exit(1);
}
async function load() {
  const { fragments, errors } = parseFragments(await readFragmentFiles());
  const features = JSON.parse(await readFile(FEATURES_FILE, "utf8")) as Record<string, boolean>;
  return { fragments, features, errors };
}

if (command === "new") {
  if (!arg || !CHANGELOG_ID.test(arg) || arg.length > 80)
    fail(["Supply a stable lowercase slug: npm run changelog:new -- evening-filter"]);
  const path = `${ENTRIES_DIR}/${arg}.json`;
  const scaffold = {
    id: arg,
    type: "improved",
    title: "What changed for people using the site",
    body: "The benefit, and anything a reader needs to do, in one or two sentences.",
    visibility: "internal",
    reason: "Replace with why this has no user-facing effect, or make the entry public.",
  };
  await writeFile(path, `${JSON.stringify(scaffold, null, 2)}\n`, { flag: "wx" });
  console.log(`Created ${path}`);
} else if (command === "validate" || command === "build") {
  const { fragments, features, errors } = await load();
  const revision = process.env.GITHUB_SHA || git("rev-parse", "HEAD");
  const built = buildBundle(fragments, features, fragmentAddedTimes(), revision);
  fail([...errors, ...built.errors]);
  if (command === "build") {
    await mkdir("public", { recursive: true });
    await writeFile("public/changelog.json", built.content);
    await writeFile("public/version.json", `${JSON.stringify(built.version)}\n`);
  }
  console.log(`${built.version.entryIds.length} public changelog entries at ${revision}`);
} else if (command === "policy") {
  if (!arg) fail(["Supply the PR base: npm run changelog:policy -- origin/main"]);
  const changes = git("diff", "--name-status", "--no-renames", `${arg}...HEAD`)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status = "", path = ""] = line.split("\t");
      return { status, path };
    });
  const { errors } = await load();
  fail([...errors, ...checkPolicy(changes)]);
  console.log("Changelog policy satisfied");
} else fail(["Usage: changelog new <id> | validate | build | policy <base>"]);
