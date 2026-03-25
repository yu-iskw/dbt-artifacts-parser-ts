import { test, expect } from "@playwright/test";
import { loadWorkspace } from "./helpers/preload";

const SEARCH_TIMELINE_LABEL = "Search timeline nodes";

test.describe("timeline workspace", () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await page.getByRole("button", { name: "Timeline", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Timeline" }).first(),
    ).toBeVisible();
  });

  test("shows execution timeline heading and canvas", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Execution timeline" }).first(),
    ).toBeVisible();
    await expect(page.locator(".chart-frame canvas").first()).toBeVisible();
  });

  test("shows bottlenecks and search controls", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Bottlenecks" }),
    ).toBeVisible();
    await expect(page.getByLabel(SEARCH_TIMELINE_LABEL)).toBeVisible();
  });

  test("clicking the chart keeps inspector available", async ({ page }) => {
    await expect(
      page.getByText("Select a node to inspect runtime evidence"),
    ).toBeVisible();
  });
});
