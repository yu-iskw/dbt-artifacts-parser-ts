import { test, expect } from "@playwright/test";
import { loadWorkspace } from "./helpers/preload";

const LEAF_SELECTOR = ".explorer-tree__row--leaf";
const BRANCH_SELECTOR = ".explorer-tree__row--branch";
const BRANCH_LABEL_SELECTOR = ".explorer-tree__label";
const MACRO_LEAF_NAME = "bigquery__cents_to_dollars";
const MACROS_BRANCH_NAME = "macros";
const PRODUCTS_MODEL_TITLE = "model.jaffle_shop.products";

test.describe("inventory workspace", () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await page.goto("/?view=inventory");
    await expect(
      page.getByRole("heading", { name: "Inventory" }).first(),
    ).toBeVisible();
  });

  test("shows explorer and stacked selected asset sections", async ({
    page,
  }) => {
    await expect(
      page.getByText("Browse, filter, and inspect all workspace assets."),
    ).toBeVisible();
    await expect(page.locator(LEAF_SELECTOR).first()).toBeVisible();
    await page.locator(LEAF_SELECTOR).first().click();
    await expect(page.locator(".workspace-scaffold__inspector")).toHaveCount(0);
    await expect(page.getByLabel("Asset sections")).toHaveCount(0);
    await expect(page.getByText("Asset summary")).toBeVisible();
    await expect(page.getByText("Asset details")).toHaveCount(0);
    const assetActions = page.locator(".asset-hero__actions");
    await expect(assetActions).not.toContainText("Open in Runs");
    for (const action of ["Open in Timeline", "Expand lineage"]) {
      await expect(
        assetActions.getByRole("button", { name: action, exact: true }),
      ).toBeVisible();
    }
    await expect(
      page.getByRole("heading", { name: "Lineage graph" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Runtime" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tests" })).toBeVisible();
  });

  test("branch rows fold and unfold the inventory tree", async ({ page }) => {
    const macrosBranch = page.locator(BRANCH_SELECTOR, {
      has: page.locator(BRANCH_LABEL_SELECTOR, {
        hasText: MACROS_BRANCH_NAME,
      }),
    });
    const macroLeaf = page.locator(LEAF_SELECTOR, {
      hasText: MACRO_LEAF_NAME,
    });
    const productsLeaf = page.locator(
      `${LEAF_SELECTOR}[title="${PRODUCTS_MODEL_TITLE}"]`,
    );
    await expect(macrosBranch).toBeVisible();
    await expect(macroLeaf).toBeVisible();

    await productsLeaf.click();
    await macrosBranch.click();
    await expect(macroLeaf).toHaveCount(0);

    await macrosBranch.click();
    await expect(macroLeaf).toBeVisible();
  });

  test("collapsing a selected asset branch keeps selection but hides the tree path", async ({
    page,
  }) => {
    const modelsBranch = page.locator(BRANCH_SELECTOR, {
      has: page.locator(BRANCH_LABEL_SELECTOR, { hasText: "models" }),
    });
    const martsBranch = page.locator(BRANCH_SELECTOR, {
      has: page.locator(BRANCH_LABEL_SELECTOR, { hasText: "marts" }),
    });
    const ordersLeaf = page.locator(
      `${LEAF_SELECTOR}[title="model.jaffle_shop.orders"]`,
    );

    await ordersLeaf.click();
    await expect(page.getByRole("heading", { name: "orders" })).toBeVisible();

    await martsBranch.click();
    await expect(ordersLeaf).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "orders" })).toBeVisible();

    await modelsBranch.click();
    await expect(martsBranch).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "orders" })).toBeVisible();

    await modelsBranch.click();
    await expect(martsBranch).toBeVisible();
    await martsBranch.click();
    await expect(ordersLeaf).toBeVisible();
  });

  test("deep-linked selections reveal the path once but can still be collapsed", async ({
    page,
  }) => {
    const macrosBranch = page.locator(BRANCH_SELECTOR, {
      has: page.locator(BRANCH_LABEL_SELECTOR, {
        hasText: MACROS_BRANCH_NAME,
      }),
    });
    const macroLeaf = page.locator(LEAF_SELECTOR, {
      hasText: MACRO_LEAF_NAME,
    });

    await page.goto(
      "/?view=inventory&resource=macro.jaffle_shop.bigquery__cents_to_dollars",
    );
    await expect(macrosBranch).toBeVisible();
    await expect(macroLeaf).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "bigquery__cents_to_dollars" }),
    ).toBeVisible();

    await macrosBranch.click();
    await expect(macroLeaf).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "bigquery__cents_to_dollars" }),
    ).toBeVisible();
  });

  test("deep-link assetTab still anchors the stacked document", async ({
    page,
  }) => {
    await page.goto(
      "/?view=inventory&resource=model.jaffle_shop.products&assetTab=lineage",
    );
    await expect(
      page.getByRole("heading", { name: "Lineage graph" }).first(),
    ).toBeVisible();
    const lineageNodeStats = page.locator(".dependency-graph__node-stat");
    await expect(lineageNodeStats.first()).toContainText(/\d+/);
    const statTexts = await lineageNodeStats.allTextContents();
    expect(statTexts.some((text) => /\d+/.test(text))).toBeTruthy();
    expect(statTexts.every((text) => !text.includes("✓"))).toBeTruthy();
    expect(statTexts.every((text) => !text.includes("✗"))).toBeTruthy();
    await expect(page).toHaveURL(/assetTab=lineage/);
  });

  test("expand lineage opens the embedded fullscreen dialog", async ({
    page,
  }) => {
    await page.locator(LEAF_SELECTOR).first().click();
    await page
      .getByRole("button", { name: "Expand lineage", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const dialogPanel = page.locator(".lineage-dialog__panel");
    await expect(dialogPanel).toBeVisible();
    const panelBox = await dialogPanel.boundingBox();
    const explorerPanel = page.getByRole("complementary").first();
    const explorerBox = await explorerPanel.boundingBox();
    expect(panelBox?.width ?? 0).toBeGreaterThan(
      (explorerBox?.width ?? 0) * 1.75,
    );
    const closeButton = page.locator(".lineage-dialog__close");
    await expect(closeButton).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close", exact: true }),
    ).toHaveCount(0);
    await closeButton.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
