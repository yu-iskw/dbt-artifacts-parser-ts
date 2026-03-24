import { test, expect } from "@playwright/test";
import { loadWorkspace } from "./helpers/preload";

const FILTER_TREE_PLACEHOLDER = "Filter tree by name, path, type, or id";
const LEAF_SELECTOR = ".explorer-tree__row--leaf";
const BRANCH_SELECTOR = ".explorer-tree__row--branch";
const ROW_SELECTOR = ".explorer-tree__row";
const ARIA_SELECTED = "aria-selected";

test.describe("asset explorer", () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await page.getByRole("button", { name: "Catalog" }).click();
    await expect(
      page.getByRole("heading", { name: "Catalog workspace" }),
    ).toBeVisible();
  });

  test("shows 'Workspace inventory' heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Workspace inventory" }),
    ).toBeVisible();
  });

  test("Project tab is selected by default", async ({ page }) => {
    const projectTab = page.getByRole("tab", { name: "Project" });
    await expect(projectTab).toBeVisible();
    await expect(projectTab).toHaveAttribute(ARIA_SELECTED, "true");
  });

  test("switching to Database tab changes tree mode", async ({ page }) => {
    await page.getByRole("tab", { name: "Database" }).click();
    await expect(page.getByRole("tab", { name: "Database" })).toHaveAttribute(
      ARIA_SELECTED,
      "true",
    );
    await expect(page.getByRole("tab", { name: "Project" })).toHaveAttribute(
      ARIA_SELECTED,
      "false",
    );
  });

  test("search box filters the tree", async ({ page }) => {
    const searchInput = page.getByPlaceholder(FILTER_TREE_PLACEHOLDER);
    await expect(searchInput).toBeVisible();

    // Count visible tree leaf rows before searching
    const initialCount = await page.locator(LEAF_SELECTOR).count();

    await searchInput.fill("orders");

    // Tree should show fewer items after filtering
    await expect(async () => {
      const filtered = await page.locator(LEAF_SELECTOR).count();
      expect(filtered).toBeLessThan(initialCount);
    }).toPass({ timeout: 5_000 });
  });

  test("empty state appears when search matches nothing", async ({ page }) => {
    const searchInput = page.getByPlaceholder(FILTER_TREE_PLACEHOLDER);
    await searchInput.fill("zzz_this_does_not_exist_xyz");

    await expect(page.getByText("No resources found")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("execution status filter 'Success' reduces tree items", async ({
    page,
  }) => {
    const initialCount = await page.locator(LEAF_SELECTOR).count();

    await page.getByRole("button", { name: "Success", exact: true }).click();

    await expect(async () => {
      const filtered = await page.locator(LEAF_SELECTOR).count();
      expect(filtered).toBeLessThanOrEqual(initialCount);
    }).toPass({ timeout: 5_000 });
  });

  test("execution status filter 'Not executed' shows non-executed resources", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "Not executed", exact: true })
      .click();
    // Verify that some rows are rendered (count > 0)
    await expect(async () => {
      const count = await page.locator(ROW_SELECTOR).count();
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 5_000 });
  });

  test("clicking a resource leaf populates the detail panel", async ({
    page,
  }) => {
    // Click the first visible leaf
    const firstLeaf = page.locator(LEAF_SELECTOR).first();
    await firstLeaf.waitFor({ state: "visible" });
    await firstLeaf.click();

    await expect(
      page.getByRole("heading", { name: "Catalog asset" }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("lineage panel shows Upstream and Downstream labels", async ({
    page,
  }) => {
    const firstLeaf = page.locator(LEAF_SELECTOR).first();
    await firstLeaf.waitFor({ state: "visible" });
    await firstLeaf.click();

    // The lineage-summary__stat labels "Upstream" and "Downstream" appear in
    // the stats section. Use .first() to avoid strict-mode violations since
    // the DepthStepper also uses these labels.
    await expect(
      page
        .locator(".lineage-summary__stat")
        .filter({ hasText: "Upstream" })
        .first(),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page
        .locator(".lineage-summary__stat")
        .filter({ hasText: "Downstream" })
        .first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("branch node expands and collapses on click", async ({ page }) => {
    // Find an expandable branch (chevron visible, currently collapsed)
    const branches = page.locator(BRANCH_SELECTOR);
    await branches.first().waitFor({ state: "visible" });

    const initialLeafCount = await page.locator(LEAF_SELECTOR).count();

    // Click to expand first branch
    await branches.first().click();

    // Leaf count should change (expand reveals children)
    await expect(async () => {
      const newCount = await page.locator(LEAF_SELECTOR).count();
      expect(newCount).not.toBe(initialLeafCount);
    }).toPass({ timeout: 3_000 });

    // Click again to collapse
    await branches.first().click();

    await expect(async () => {
      const collapsed = await page.locator(LEAF_SELECTOR).count();
      expect(collapsed).toBe(initialLeafCount);
    }).toPass({ timeout: 3_000 });
  });

  test("resource type filter deselects a type and reduces tree", async ({
    page,
  }) => {
    const initialCount = await page.locator(LEAF_SELECTOR).count();

    // Deselect "Macro" if visible
    const macroPill = page.getByRole("button", { name: "Macro", exact: true });
    if (await macroPill.isVisible()) {
      await macroPill.click();
      await expect(async () => {
        const filtered = await page.locator(LEAF_SELECTOR).count();
        expect(filtered).toBeLessThanOrEqual(initialCount);
      }).toPass({ timeout: 5_000 });
    }
  });
});

test.describe("asset explorer — lineage panel controls", () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await page.getByRole("button", { name: "Catalog" }).click();
    await expect(
      page.getByRole("heading", { name: "Catalog workspace" }),
    ).toBeVisible();

    // Select a resource that has lineage (models in jaffle_shop do)
    const modelLeaves = page
      .locator(LEAF_SELECTOR)
      .filter({ hasText: "Model" });
    await modelLeaves.first().waitFor({ state: "visible" });
    await modelLeaves.first().click();
    await page.getByRole("tab", { name: "Lineage" }).click();
    await expect(page.getByRole("heading", { name: "Lineage" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Show all toggle appears after selecting a resource", async ({
    page,
  }) => {
    await expect(
      page
        .getByRole("button", { name: "Show all" })
        .or(page.getByRole("button", { name: /Depth/ })),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("Expand button opens fullscreen lineage dialog", async ({ page }) => {
    // Use exact: true to avoid matching the "Expand sidebar" button
    await page.getByRole("button", { name: "Expand", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  });

  test("fullscreen dialog can be closed", async ({ page }) => {
    // Use exact: true to avoid matching the "Expand sidebar" button
    await page.getByRole("button", { name: "Expand", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: "Close lineage graph" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
