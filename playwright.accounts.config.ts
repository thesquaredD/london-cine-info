import { homedir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/auth",
  outputDir: process.env.CI
    ? "test-results/accounts"
    : join(homedir(), ".Codex/london-cine-info/watchlist/verification"),
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:4174", trace: "retain-on-failure", video: "on" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1200, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "npx wrangler pages dev dist --port 4174 --binding DEV_MAGIC_LINK=1",
    url: "http://localhost:4174",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
