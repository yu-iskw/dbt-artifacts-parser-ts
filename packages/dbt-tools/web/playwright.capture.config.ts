import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

/** Directory containing this config (package root for `vite preview` + `dist/`). */
const webPackageDir = path.dirname(fileURLToPath(import.meta.url));

const e2ePort = Number(process.env.PLAYWRIGHT_E2E_PORT ?? "4173");
const e2eOrigin = `http://127.0.0.1:${e2ePort}`;

/**
 * Dedicated config for PR visual capture (screenshots + screencast videos).
 * Keeps capture isolated from sharded E2E runs in `playwright.config.ts`.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /pr-capture\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["line"]] : "list",
  use: {
    baseURL: e2eOrigin,
    trace: "off",
  },
  webServer: {
    command: `./node_modules/.bin/vite preview --host 127.0.0.1 --port ${e2ePort}`,
    cwd: webPackageDir,
    url: e2eOrigin,
    reuseExistingServer: process.env.GITHUB_ACTIONS !== "true",
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
