import { test, expect } from "@playwright/test";
import { loadWorkspace } from "./helpers/preload";

test.describe("runs workspace", () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await page.getByRole("button", { name: "Runs", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Runs" }).first(),
    ).toBeVisible();
  });

  test("shows unified evidence table and filters", async ({ page }) => {
    await expect(
      page.getByText("Execution and quality evidence"),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("Filter by name, type, status, thread…"),
    ).toBeVisible();
    await expect(page.locator(".results-table__header")).toContainText([
      "Item",
      "Type",
      "Status",
      "Duration",
      "Thread",
    ]);
  });

  test("shows expected facets", async ({ page }) => {
    for (const label of [
      "All",
      "Models",
      "Tests",
      "Seeds",
      "Snapshots",
      "Operations",
      "Healthy",
      "Warnings",
      "Errors",
    ]) {
      await expect(
        page.getByRole("button", { name: new RegExp(label) }).first(),
      ).toBeVisible();
    }
  });

  test("selecting a row opens the inspector", async ({ page }) => {
    await expect(page.locator(".results-table__row").first()).toBeVisible();
    await page.locator(".results-table__row").first().click();
    await expect(page.getByText("Open in Timeline")).toBeVisible();
    await expect(page.getByText("Open in Inventory")).toBeVisible();
  });
});
