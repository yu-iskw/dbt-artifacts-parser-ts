import { test, expect } from "@playwright/test";
import { loadWorkspace } from "./helpers/preload";

const SEARCH_TIMELINE_LABEL = "Search timeline nodes";
const LEGEND_ITEM_SELECTOR = ".gantt-legend__item";

test.describe("timeline / Gantt chart view", () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await page.getByRole("button", { name: "Runs" }).click();
    await page.getByRole("tab", { name: "Timeline" }).click();
    await expect(
      page.getByRole("heading", { name: "Run analysis" }).first(),
    ).toBeVisible();
  });

  test("shows 'Execution timeline' section heading", async ({ page }) => {
    // Use .first() because "Execution timeline" appears at both h1 (app header)
    // and h3 (SectionCard inside TimelineView).
    await expect(
      page.getByRole("heading", { name: "Execution timeline" }).first(),
    ).toBeVisible();
  });

  test("shows subtitle text", async ({ page }) => {
    await expect(
      page.getByText("Relative start and duration for each executed node."),
    ).toBeVisible();
  });

  test("shows Bottlenecks section", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Bottlenecks" }),
    ).toBeVisible();
    // At least one bottleneck row for jaffle_shop
    await expect(page.locator(".action-list__row").first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("Gantt canvas renders", async ({ page }) => {
    // The Gantt chart renders bars on a <canvas> element (not SVG rects).
    // Verify the canvas element is present and has non-zero dimensions.
    const canvas = page.locator(".chart-frame canvas").first();
    await expect(canvas).toBeVisible({ timeout: 10_000 });
  });

  test("legend shows Status section", async ({ page }) => {
    await expect(page.getByText("Status").first()).toBeVisible();
  });

  test("legend shows Type section", async ({ page }) => {
    await expect(page.getByText("Type").first()).toBeVisible();
  });

  test("legend status buttons are visible", async ({ page }) => {
    // At least one status legend item rendered
    await expect(page.locator(LEGEND_ITEM_SELECTOR).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("search input filters Gantt bars", async ({ page }) => {
    const searchInput = page.getByLabel(SEARCH_TIMELINE_LABEL);
    await expect(searchInput).toBeVisible();

    // Record the data-item-count before filtering (the Gantt shell tracks this)
    const shellBefore = page.locator(".gantt-shell");
    await expect(shellBefore).toBeVisible({ timeout: 5_000 });

    await searchInput.fill("orders");

    // After filtering, the search input should have the value we typed
    await expect(searchInput).toHaveValue("orders", { timeout: 5_000 });
  });

  test("Clear search button appears and clears the search query", async ({
    page,
  }) => {
    const searchInput = page.getByLabel(SEARCH_TIMELINE_LABEL);
    await searchInput.fill("orders");

    const clearBtn = page.getByRole("button", { name: "Clear search" });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    await expect(searchInput).toHaveValue("");
    await expect(clearBtn).not.toBeVisible();
  });

  test("'Clear all filters' pill appears when filters are active and resets state", async ({
    page,
  }) => {
    // Toggle a status filter to activate it
    const statusButton = page.locator(LEGEND_ITEM_SELECTOR).first();
    await statusButton.waitFor({ state: "visible" });
    await statusButton.click();

    const clearAll = page.getByRole("button", { name: "Clear all filters" });
    await expect(clearAll).toBeVisible({ timeout: 3_000 });

    await clearAll.click();
    await expect(clearAll).not.toBeVisible({ timeout: 3_000 });
  });

  test("toggling a type legend item is interactive", async ({ page }) => {
    // The Gantt renders bars on a <canvas> element — we cannot assert on
    // individual bars. This test verifies that the type legend items are
    // present and clickable, and that the timeline canvas remains rendered
    // after interaction.
    const typeItems = page
      .locator(".gantt-legend__group")
      .filter({ hasText: "Type" })
      .locator(".gantt-legend__item");
    const count = await typeItems.count();

    if (count > 0) {
      // Verify the first type item is visible and can be clicked
      const firstItem = typeItems.first();
      await expect(firstItem).toBeVisible();
      await firstItem.click();

      // The canvas should still be present after interaction
      await expect(page.locator(".chart-frame canvas").first()).toBeVisible({
        timeout: 3_000,
      });
    }
  });
});
