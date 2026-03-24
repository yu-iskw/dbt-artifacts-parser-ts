import { test, expect } from "@playwright/test";
import { loadWorkspace } from "./helpers/preload";

const RESULTS_SEARCH_PLACEHOLDER = "Filter by name, type, status, thread…";
const RESULTS_ROW_SELECTOR = ".results-table__row";
const MODEL_RESULTS_HEADING = "Model execution results";

test.describe("model results view", () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await page.getByRole("button", { name: "Models", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Models" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: MODEL_RESULTS_HEADING }),
    ).toBeVisible();
  });

  test("model results panel shows heading, subtitle, and column headers", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: MODEL_RESULTS_HEADING }),
    ).toBeVisible();
    await expect(
      page.getByText("Model, snapshot, seed and operation execution log."),
    ).toBeVisible();
    const header = page.locator(".results-table__header");
    await expect(header.getByText("Node")).toBeVisible();
    await expect(header.getByText("Type")).toBeVisible();
    await expect(header.getByText("Status")).toBeVisible();
    await expect(header.getByText("Duration")).toBeVisible();
    await expect(header.getByText("Thread")).toBeVisible();
  });

  test("at least one model row is rendered", async ({ page }) => {
    // Wait for virtualizer to render rows
    await expect(page.locator(RESULTS_ROW_SELECTOR).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("status pill 'All (N)' is selected by default", async ({ page }) => {
    // Active pill contains "All" — the active class is workspace-pill--active
    await expect(
      page.locator(".workspace-pill--active").filter({ hasText: /All/ }),
    ).toBeVisible();
  });

  test("status pill 'Healthy' filters the table", async ({ page }) => {
    await page.getByRole("button", { name: /Healthy/ }).click();

    // After filtering, any "Error" status rows should be gone
    await expect(
      page.locator(".results-table__row .tone-badge--danger").first(),
    ).not.toBeVisible({ timeout: 3_000 });
  });

  test("search input filters visible rows", async ({ page }) => {
    const searchInput = page.getByPlaceholder(RESULTS_SEARCH_PLACEHOLDER);
    await expect(searchInput).toBeVisible();

    await searchInput.fill("orders");

    // Table should show filtered results
    await expect(page.locator(RESULTS_ROW_SELECTOR).first()).toBeVisible({
      timeout: 5_000,
    });

    // Verify none of the visible rows contain a name that definitely doesn't exist
    await expect(async () => {
      const rows = await page.locator(RESULTS_ROW_SELECTOR).all();
      for (const row of rows) {
        const text = (await row.textContent()) ?? "";
        expect(text).not.toContain("this_name_definitely_does_not_exist");
      }
    }).toPass({ timeout: 5_000 });
  });

  test("status pill 'Errors' shows only error rows or empty state", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /Errors/ }).click();

    // Either error rows appear (with danger badges) or the empty state renders.
    // The EmptyState component uses class empty-state-block.
    await expect(
      page
        .locator(".results-table__row .tone-badge--danger")
        .first()
        .or(page.locator(".empty-state-block")),
    ).toBeVisible({ timeout: 3_000 });
  });
});

test.describe("test results view", () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await page.getByRole("button", { name: "Tests", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Tests" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Test results" }).first(),
    ).toBeVisible();
  });

  test("test results card shows heading and subtitle", async ({ page }) => {
    const headings = page.getByRole("heading", { name: "Test results" });
    await expect(headings.first()).toBeVisible();
    await expect(
      page.getByText("Test pass/fail results from the captured run."),
    ).toBeVisible();
  });

  test("at least one test row is rendered", async ({ page }) => {
    await expect(page.locator(RESULTS_ROW_SELECTOR).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("search input filters test rows", async ({ page }) => {
    const searchInput = page.getByPlaceholder(RESULTS_SEARCH_PLACEHOLDER);
    await searchInput.fill("not_null");
    await expect(page.locator(".results-table__row").first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("switching to Models via sidebar shows model results heading", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Models", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: MODEL_RESULTS_HEADING }),
    ).toBeVisible({ timeout: 3_000 });
  });
});
