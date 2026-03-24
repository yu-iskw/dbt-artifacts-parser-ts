import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import {
  MANIFEST_PATH,
  RUN_RESULTS_PATH,
  mockPreload,
  loadWorkspace,
} from "./helpers/preload";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ANALYZE_BUTTON_LABEL = "Analyze artifacts";
const RUN_OVERVIEW_HEADING = "Run overview";
const MANIFEST_INPUT = "#manifest-input";
const RUN_RESULTS_INPUT = "#run-results-input";

const invalidJsonPath = path.resolve(__dirname, "fixtures/invalid.json");

test.describe("analyze flow — static UI (no artifact load)", () => {
  test("Analyze button is disabled when no files selected", async ({
    page,
  }) => {
    await page.goto("/");
    const analyzeButton = page.getByRole("button", {
      name: ANALYZE_BUTTON_LABEL,
    });
    await expect(analyzeButton).toBeDisabled();
  });

  test("landing page shows workspace navigation", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("navigation", { name: "Workspace sections" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Overview", exact: true }),
    ).toBeVisible();
  });

  test("Analyze button label transitions as files are selected", async ({
    page,
  }) => {
    await page.goto("/");

    const analyzeButton = page.getByRole("button", {
      name: ANALYZE_BUTTON_LABEL,
    });
    await expect(analyzeButton).toBeDisabled();

    // Select first file — button still disabled but label may change
    await page.locator(MANIFEST_INPUT).setInputFiles(MANIFEST_PATH);
    await expect(analyzeButton).toBeDisabled();

    // Select second file — button should enable
    await page.locator(RUN_RESULTS_INPUT).setInputFiles(RUN_RESULTS_PATH);
    await expect(analyzeButton).toBeEnabled({ timeout: 5_000 });
  });
});

test.describe("analyze flow — file upload happy path", () => {
  test("upload valid artifacts loads workspace and enables nav", async ({
    page,
  }) => {
    await page.goto("/");

    await page.locator(MANIFEST_INPUT).setInputFiles(MANIFEST_PATH);
    await page.locator(RUN_RESULTS_INPUT).setInputFiles(RUN_RESULTS_PATH);

    await expect(
      page.getByRole("button", { name: ANALYZE_BUTTON_LABEL }),
    ).toBeEnabled({ timeout: 5_000 });

    await page.getByRole("button", { name: ANALYZE_BUTTON_LABEL }).click();

    // Workspace header h2 should show "Run overview"
    await expect(
      page.getByRole("heading", { name: RUN_OVERVIEW_HEADING }),
    ).toBeVisible({ timeout: 30_000 });

    // Sidebar nav buttons become enabled after analysis loads
    await expect(page.getByRole("button", { name: "Catalog" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Runs" })).toBeEnabled();
  });
});

test.describe("analyze flow — preload mock happy path", () => {
  test("preload via /api/* mounts workspace", async ({ page }) => {
    await loadWorkspace(page);

    await expect(
      page.getByRole("heading", { name: RUN_OVERVIEW_HEADING }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("Load different artifacts button resets to upload UI", async ({
    page,
  }) => {
    await loadWorkspace(page);

    await page
      .getByRole("button", { name: "Load different artifacts" })
      .click();

    // After reset, Analyze button should be disabled (no files selected)
    await expect(
      page.getByRole("button", { name: ANALYZE_BUTTON_LABEL }),
    ).toBeDisabled({ timeout: 5_000 });
  });
});

test.describe("analyze flow — error handling", () => {
  test("invalid manifest shows error message", async ({ page }) => {
    await page.goto("/");

    await page.locator(MANIFEST_INPUT).setInputFiles(invalidJsonPath);
    await page.locator(RUN_RESULTS_INPUT).setInputFiles(RUN_RESULTS_PATH);

    await expect(
      page.getByRole("button", { name: ANALYZE_BUTTON_LABEL }),
    ).toBeEnabled({ timeout: 5_000 });
    await page.getByRole("button", { name: ANALYZE_BUTTON_LABEL }).click();

    await expect(
      page.getByText(/Not a manifest|Failed to parse|invalid/i),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("preload 404 keeps upload UI visible", async ({ page }) => {
    // Return 404 for both preload endpoints → app stays on upload screen
    await page.route("**/api/manifest.json", (route) =>
      route.fulfill({ status: 404 }),
    );
    await page.route("**/api/run_results.json", (route) =>
      route.fulfill({ status: 404 }),
    );

    await page.goto("/");

    // Upload button should be present
    await expect(
      page.getByRole("button", { name: ANALYZE_BUTTON_LABEL }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("mockPreload can be used independently", async ({ page }) => {
    // Verify mockPreload helper function is exported and callable
    await mockPreload(page);
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Overview", exact: true }),
    ).toBeEnabled({
      timeout: 30_000,
    });
  });
});
