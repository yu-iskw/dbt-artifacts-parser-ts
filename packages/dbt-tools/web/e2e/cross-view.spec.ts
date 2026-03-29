import { test, expect } from "@playwright/test";
import { loadWorkspace } from "./helpers/preload";

const LEAF_SELECTOR = ".explorer-tree__row--leaf";
const OPEN_IN_TIMELINE_LABEL = "Open in Timeline";

test.describe("health cross-view pills", () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await expect(
      page.getByRole("heading", { name: "Health" }).first(),
    ).toBeVisible();
  });

  test("Open Runs navigates to runs view", async ({ page }) => {
    await page.getByRole("button", { name: "Open Runs" }).click();
    await expect(
      page.getByRole("heading", { name: "Runs" }).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/[?&]view=runs/);
  });

  test("Open Timeline navigates to timeline view", async ({ page }) => {
    await page.getByRole("button", { name: "Open Timeline" }).click();
    await expect(
      page.getByRole("heading", { name: "Timeline" }).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/[?&]view=timeline/);
  });

  test("Browse Inventory navigates to inventory view", async ({ page }) => {
    await page.getByRole("button", { name: "Browse Inventory" }).click();
    await expect(
      page.getByRole("heading", { name: "Inventory" }).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/[?&]view=inventory/);
  });

  test("Open Lineage navigates to inventory with lineage tab", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Open Lineage" }).click();
    await expect(
      page.getByRole("heading", { name: "Inventory" }).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/[?&]view=inventory/);
    await expect(page).toHaveURL(/[?&]assetTab=lineage/);
    await expect(
      page.getByRole("heading", { name: "Lineage graph" }).first(),
    ).toBeVisible();
  });
});

test.describe("inventory to timeline cross-view", () => {
  test("Open in Timeline from asset hero navigates with selected execution", async ({
    page,
  }) => {
    await loadWorkspace(page);
    await page.goto("/?view=inventory");
    await expect(
      page.getByRole("heading", { name: "Inventory" }).first(),
    ).toBeVisible();

    await expect(page.locator(LEAF_SELECTOR).first()).toBeVisible();
    await page.locator(LEAF_SELECTOR).first().click();
    await expect(page.getByText("Asset summary")).toBeVisible();

    await page
      .getByRole("button", { name: OPEN_IN_TIMELINE_LABEL, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Timeline" }).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/[?&]view=timeline/);
    await expect(page).toHaveURL(/[?&]selected=/);
  });
});
