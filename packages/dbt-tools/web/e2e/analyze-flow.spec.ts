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
const MANIFEST_INPUT = "#manifest-input";
const RUN_RESULTS_INPUT = "#run-results-input";
const invalidJsonPath = path.resolve(__dirname, "fixtures/invalid.json");

test.describe("analyze flow", () => {
  test("landing page shows new workspace navigation", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("navigation", { name: "Workspace sections" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Health", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Runs", exact: true }),
    ).toBeVisible();
  });

  test("upload valid artifacts loads health workspace", async ({ page }) => {
    await page.goto("/");
    await page.locator(MANIFEST_INPUT).setInputFiles(MANIFEST_PATH);
    await page.locator(RUN_RESULTS_INPUT).setInputFiles(RUN_RESULTS_PATH);
    await page.getByRole("button", { name: ANALYZE_BUTTON_LABEL }).click();
    await expect(
      page.getByRole("heading", { name: "Health" }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("preload mock mounts workspace", async ({ page }) => {
    await loadWorkspace(page);
    await expect(
      page.getByRole("heading", { name: "Health" }).first(),
    ).toBeVisible();
  });

  test("invalid manifest shows error message", async ({ page }) => {
    await page.goto("/");
    await page.locator(MANIFEST_INPUT).setInputFiles(invalidJsonPath);
    await page.locator(RUN_RESULTS_INPUT).setInputFiles(RUN_RESULTS_PATH);
    await page.getByRole("button", { name: ANALYZE_BUTTON_LABEL }).click();
    await expect(page.locator(".error-banner").first()).toContainText(
      /Not a manifest|Failed to parse/i,
      { timeout: 15_000 },
    );
  });

  test("mockPreload helper is sufficient to enable nav", async ({ page }) => {
    await mockPreload(page);
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Inventory", exact: true }),
    ).toBeEnabled({ timeout: 30_000 });
  });
});
