import { test, expect } from "@playwright/test";
import { loadWorkspace } from "./helpers/preload";

test.describe("health view", () => {
  test.beforeEach(async ({ page }) => {
    await loadWorkspace(page);
    await expect(
      page.getByRole("heading", { name: "Health" }).first(),
    ).toBeVisible();
  });

  test("shows posture and drilldown affordances", async ({ page }) => {
    await expect(
      page.getByText(
        "Run posture, critical issues, and dependency pressure at a glance.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Run posture" }),
    ).toBeVisible();
    await expect(
      page
        .locator("#app-sidebar")
        .getByRole("button", { name: "Runs", exact: true }),
    ).toBeVisible();
  });

  test("shows major analysis sections", async ({ page }) => {
    for (const heading of [
      "Bottlenecks",
      "Critical path",
      "Execution breakdown",
      "Execution context",
      "Structural health",
    ]) {
      await expect(
        page.getByRole("heading", { name: heading }).first(),
      ).toBeVisible();
    }
  });

  test("execution breakdown exposes Refine slice control", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /^Refine slice ·/ }),
    ).toBeVisible();
  });
});
