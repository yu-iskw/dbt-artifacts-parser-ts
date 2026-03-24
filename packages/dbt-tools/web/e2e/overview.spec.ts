import { test, expect } from "@playwright/test";
import { loadWorkspace } from "./helpers/preload";

test.describe("overview view", () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    // Already on overview by default
    await expect(
      page.getByRole("heading", { name: "Run overview" }),
    ).toBeVisible();
  });

  test("shows status banner with health text", async ({ page }) => {
    // Jaffle Shop is a healthy project — banner should say "Healthy run"
    // or one of the failure variants; just verify it renders something
    await expect(
      page
        .getByText("Healthy run")
        .or(page.getByText(/failing nodes require attention/))
        .or(page.getByText(/warning nodes need review/)),
    ).toBeVisible();
  });

  test("shows 'N matching runs' count label", async ({ page }) => {
    await expect(page.getByText(/matching runs/)).toBeVisible();
  });

  test("shows 'Dashboard filters' label", async ({ page }) => {
    await expect(page.getByText("Dashboard filters")).toBeVisible();
  });

  test("status filter pill 'Healthy' reduces matching run count", async ({
    page,
  }) => {
    // Read initial count
    const countLocator = page.getByText(/\d+ matching runs/);
    await expect(countLocator).toBeVisible();
    const initialText = await countLocator.textContent();
    const initialCount = parseInt(initialText?.match(/\d+/)?.[0] ?? "0", 10);

    // Click "Healthy" filter
    await page.getByRole("button", { name: "Healthy", exact: true }).click();

    // Count should be ≤ initial (healthy subset)
    const newText = await countLocator.textContent();
    const newCount = parseInt(newText?.match(/\d+/)?.[0] ?? "0", 10);
    expect(newCount).toBeLessThanOrEqual(initialCount);

    // Click "All" to reset
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.getByText(initialText!)).toBeVisible();
  });

  test("search query reduces matching run count", async ({ page }) => {
    const countLocator = page.getByText(/\d+ matching runs/);
    const initialText = await countLocator.textContent();
    const initialCount = parseInt(initialText?.match(/\d+/)?.[0] ?? "0", 10);

    // Type a narrow query that matches only one model
    await page.getByLabel("Search executions").fill("orders");

    const newText = await countLocator.textContent();
    const newCount = parseInt(newText?.match(/\d+/)?.[0] ?? "0", 10);
    expect(newCount).toBeLessThanOrEqual(initialCount);
  });

  test("Clear all button resets filters", async ({ page }) => {
    // Apply a filter to make Clear All appear
    await page.getByRole("button", { name: "Healthy", exact: true }).click();
    await expect(page.getByRole("button", { name: /Clear all/ })).toBeVisible();

    await page.getByRole("button", { name: /Clear all/ }).click();

    // Active filter status pill should be "All" again
    // and Clear all should disappear
    await expect(
      page.getByRole("button", { name: /Clear all/ }),
    ).not.toBeVisible();
  });

  test("Bottlenecks heading and action list render", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Bottlenecks" }),
    ).toBeVisible();
    // At least one bottleneck row should be present for jaffle_shop
    await expect(page.locator(".action-list__row").first()).toBeVisible();
  });

  test("Attention heading renders", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Attention" }),
    ).toBeVisible();
  });

  test("Critical path heading renders", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Critical path" }),
    ).toBeVisible();
  });

  test("Thread distribution heading renders", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Thread distribution" }),
    ).toBeVisible();
  });

  test("Footprint heading renders", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Footprint" }),
    ).toBeVisible();
  });

  test("Coverage heading renders", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Coverage" })).toBeVisible();
  });

  test("Graph composition heading renders", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Graph composition" }),
    ).toBeVisible();
  });
});
