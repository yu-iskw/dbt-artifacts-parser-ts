import { test, expect } from "@playwright/test";
import { loadWorkspace } from "./helpers/preload";

const APP_SIDEBAR = "#app-sidebar";
const NAV_VIEWS = [
  { label: "Health", heading: "Health", view: "health" },
  { label: "Inventory", heading: "Inventory", view: "inventory" },
  { label: "Runs", heading: "Runs", view: "runs" },
  { label: "Timeline", heading: "Timeline", view: "timeline" },
  { label: "Lineage", heading: "Lineage", view: "lineage" },
] as const;

test.describe("sidebar navigation", () => {
  test("all primary nav buttons are visible", async ({ page }) => {
    await page.goto("/");
    for (const { label } of NAV_VIEWS) {
      await expect(
        page
          .locator(APP_SIDEBAR)
          .getByRole("button", { name: label, exact: true }),
      ).toBeVisible();
    }
    await expect(
      page
        .locator(APP_SIDEBAR)
        .getByRole("button", { name: "Search", exact: true }),
    ).toHaveCount(0);
  });

  test("clicking each nav button shows the correct heading and URL", async ({
    page,
  }) => {
    await loadWorkspace(page);

    for (const { label, heading, view } of NAV_VIEWS) {
      await page
        .locator(APP_SIDEBAR)
        .getByRole("button", { name: label, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: heading }).first(),
      ).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`[?&]view=${view}`));
    }
  });

  test("legacy overview URL redirects to health", async ({ page }) => {
    await loadWorkspace(page);
    await page.goto("/?view=overview");
    await expect(
      page.getByRole("heading", { name: "Health" }).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/view=health/);
  });

  test("legacy execution timeline URL redirects to timeline", async ({
    page,
  }) => {
    await loadWorkspace(page);
    await page.goto("/?view=runs&tab=timeline");
    await expect(
      page.getByRole("heading", { name: "Timeline" }).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/view=timeline/);
  });
});
