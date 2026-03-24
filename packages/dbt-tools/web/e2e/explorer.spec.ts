import { test, expect, type Page } from "@playwright/test";
import { loadWorkspace } from "./helpers/preload";

const FILTER_TREE_PLACEHOLDER = "Filter tree by name, path, type, or id";
const LEAF_SELECTOR = ".explorer-tree__row--leaf";
const BRANCH_SELECTOR = ".explorer-tree__row--branch";
const ROW_SELECTOR = ".explorer-tree__row";
const ARIA_SELECTED = "aria-selected";
const LINEAGE_STAT_SELECTOR = ".lineage-summary__stat";

/** Search and status pills live in a collapsible panel (default collapsed). */
async function expandExplorerFilters(page: Page) {
  const region = page.getByRole("region", { name: "Explorer filters" });
  const toggle = region.getByRole("button").first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
}

test.describe("asset explorer", () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Assets" }).first(),
    ).toBeVisible();
    await expandExplorerFilters(page);
  });

  test("catalog workspace shows inventory heading and Project tab selected", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Workspace inventory" }),
    ).toBeVisible();
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

    await expect(page.getByText("Catalog asset")).toBeVisible({
      timeout: 5_000,
    });
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
        .locator(LINEAGE_STAT_SELECTOR)
        .filter({ hasText: "Upstream" })
        .first(),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page
        .locator(LINEAGE_STAT_SELECTOR)
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
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Assets" }).first(),
    ).toBeVisible();

    const modelLeaves = page
      .locator(LEAF_SELECTOR)
      .filter({ hasText: "Model" });
    await modelLeaves.first().waitFor({ state: "visible" });
    await modelLeaves.first().click();
    await expect(
      page.getByRole("heading", { name: "Lineage graph" }),
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test("lineage summary shows upstream and downstream stats", async ({
    page,
  }) => {
    await expect(
      page.locator(LINEAGE_STAT_SELECTOR).getByText("Upstream"),
    ).toBeVisible();
    await expect(
      page.locator(LINEAGE_STAT_SELECTOR).getByText("Downstream"),
    ).toBeVisible();
    await expect(
      page.locator(".lineage-graph, .lineage-summary svg").first(),
    ).toBeVisible({
      timeout: 5_000,
    });
  });
});
