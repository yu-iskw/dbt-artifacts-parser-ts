import { test, expect } from "@playwright/test";
import { loadWorkspace } from "./helpers/preload";

const LEAF_SELECTOR = ".explorer-tree__row--leaf";

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
    for (const action of [
      "Open in Runs",
      "Open in Timeline",
      "Open in Lineage",
    ]) {
      await expect(
        page.getByRole("button", { name: action, exact: true }),
      ).toBeVisible();
    }
    await expect(
      page.getByRole("heading", { name: "Lineage graph" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Runtime" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tests" })).toBeVisible();
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
});
