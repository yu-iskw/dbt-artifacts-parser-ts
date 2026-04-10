/**
 * Captures representative UI stills for PR / release notes.
 * Run alone: PLAYWRIGHT_USE_SYSTEM_CHROME=1 pnpm exec playwright test e2e/pr-visual-capture.spec.ts
 * Output: e2e/screenshots/pr/*.png (committed for stable raw.githubusercontent.com links in PR bodies)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { loadWorkspace } from "./helpers/preload";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "screenshots", "pr");

test.beforeAll(() => {
  fs.mkdirSync(outDir, { recursive: true });
});

test.describe("PR visual capture", () => {
  test("landing, health workspace, settings (light)", async ({ page }) => {
    await page.goto("/");
    await page.screenshot({
      path: path.join(outDir, "01-landing-light.png"),
      fullPage: true,
    });

    await loadWorkspace(page);
    await expect(
      page.getByRole("heading", { name: "Health" }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await page.screenshot({
      path: path.join(outDir, "02-health-workspace-light.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Open settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await page.screenshot({
      path: path.join(outDir, "03-settings-light.png"),
      fullPage: true,
    });
  });

  test("health workspace (dark)", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
    });
    await loadWorkspace(page);
    await expect(
      page.getByRole("heading", { name: "Health" }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await page.screenshot({
      path: path.join(outDir, "04-health-workspace-dark.png"),
      fullPage: true,
    });
  });
});
