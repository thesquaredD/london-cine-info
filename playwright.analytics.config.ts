import { defineConfig } from "@playwright/test";
import { homedir } from "node:os";
import { join } from "node:path";
export default defineConfig({
  testDir: "./tests/analytics",
  outputDir: process.env.CI
    ? "test-results/analytics"
    : join(homedir(), ".Codex/london-cine-info/analytics/verification"),
  use: { baseURL: "http://127.0.0.1:4185", video: "on", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1200, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4185 --strictPort",
    env: { VITE_ANALYTICS_TEST: "1" },
    url: "http://127.0.0.1:4185",
    reuseExistingServer: false,
  },
});
