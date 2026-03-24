import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry keeps CI resilient without tripling wall time on every flake (was 2).
  retries: process.env.CI ? 1 : 0,
  // Fixed CI parallelism keeps the single vite preview process predictable; raise after profiling.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["line"]] : "html",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "./node_modules/.bin/vite preview --host 127.0.0.1 --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
