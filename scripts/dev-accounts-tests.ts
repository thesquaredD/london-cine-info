import { execFileSync, spawn } from "node:child_process";
import { rm } from "node:fs/promises";
const state = process.env.ACCOUNT_TEST_STATE;
if (!state) throw new Error("ACCOUNT_TEST_STATE must be supplied by the Playwright config");
const wrangler = "node_modules/wrangler/bin/wrangler.js";
execFileSync(
  process.execPath,
  [wrangler, "d1", "migrations", "apply", "london-cine-info", "--local", "--persist-to", state],
  { stdio: "inherit" },
);
const child = spawn(
  process.execPath,
  [
    wrangler,
    "pages",
    "dev",
    "dist",
    "--port",
    "4174",
    "--binding",
    "DEV_MAGIC_LINK=1",
    "--persist-to",
    state,
  ],
  { stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
child.on("exit", async (code) => {
  await rm(state, { recursive: true, force: true });
  process.exit(code ?? 0);
});
