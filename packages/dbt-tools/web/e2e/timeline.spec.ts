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
    await expect(page.locator(".workspace-scaffold__inspector")).toHaveCount(0);
    await expect(page.getByText("Selected node")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Execution timeline" }).first(),
    ).toBeVisible();
    await expect(page.locator(".chart-frame canvas").first()).toBeVisible();
  });

  test("removes bottlenecks block and keeps search controls", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Bottlenecks" }),
    ).toHaveCount(0);
    await expect(page.getByLabel(SEARCH_TIMELINE_LABEL)).toBeVisible();
  });

  test("does not show a persistent empty inspector", async ({ page }) => {
    await expect(
      page.getByText("Select a node to inspect runtime evidence"),
    ).toHaveCount(0);
  });

  test("shows timezone to the left of the mode toggle in timestamps mode", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Timestamps", exact: true }).click();
    const modeToggle = page.locator(".gantt-mode-toggle");
    const timezoneSelect = page.locator(".gantt-timezone-select");

    await expect(modeToggle).toBeVisible();
    await expect(timezoneSelect).toBeVisible();

    const toggleBox = await modeToggle.boundingBox();
    const timezoneBox = await timezoneSelect.boundingBox();

    expect(toggleBox).not.toBeNull();
    expect(timezoneBox).not.toBeNull();
    expect(timezoneBox!.x).toBeLessThan(toggleBox!.x);
  });

  test("dependency controls default to both at depth 2", async ({ page }) => {
    await expect(page.locator(".timeline-dependency-controls")).toBeVisible();
    await expect(page.getByText("Depth", { exact: true })).toBeVisible();
    await expect(page.getByText("2", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Both" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("button", { name: "Max" })).toBeVisible();
  });
});
