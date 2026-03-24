import { test, expect } from "@playwright/test";
import { loadWorkspace } from "./helpers/preload";

/** Duplicated string literals consolidated for sonarjs/no-duplicate-string */
const APP_SIDEBAR = "#app-sidebar";
const HEADING_RUN_ANALYSIS = "Run analysis";

const NAV_VIEWS = [
  { label: "Overview", heading: "Run overview" },
  { label: "Catalog", heading: "Catalog workspace" },
  { label: "Runs", heading: HEADING_RUN_ANALYSIS },
] as const;
const NAV_CHILDREN = [
  "Assets",
  "Lineage",
  "Models",
  "Tests",
  "Timeline",
] as const;
const SIDEBAR_COLLAPSE_LABEL = "Collapse sidebar";
const SIDEBAR_EXPAND_LABEL = "Expand sidebar";

test.describe("sidebar navigation", () => {
  test("all 3 nav buttons are visible", async ({ page }) => {
    await page.goto("/");
    for (const { label } of NAV_VIEWS) {
      await expect(
        page
          .locator(APP_SIDEBAR)
          .getByRole("button", { name: label, exact: true }),
      ).toBeVisible();
    }
  });

  test("expanded sidebar shows grouped child links", async ({ page }) => {
    await loadWorkspace(page);
    await page.getByRole("button", { name: SIDEBAR_EXPAND_LABEL }).click();

    for (const label of NAV_CHILDREN) {
      await expect(
        page
          .locator(APP_SIDEBAR)
          .getByRole("button", { name: label, exact: true }),
      ).toBeVisible();
    }
  });

  test("nav buttons are disabled before analysis loads", async ({ page }) => {
    // Block preload so workspace never loads
    await page.route("**/api/manifest.json", (route) =>
      route.fulfill({ status: 404 }),
    );
    await page.route("**/api/run_results.json", (route) =>
      route.fulfill({ status: 404 }),
    );
    await page.goto("/");

    for (const { label } of NAV_VIEWS) {
      await expect(
        page
          .locator(APP_SIDEBAR)
          .getByRole("button", { name: label, exact: true }),
      ).toBeDisabled();
    }
  });

  test("clicking each nav button shows the correct view heading", async ({
    page,
  }) => {
    await loadWorkspace(page);

    for (const { label, heading } of NAV_VIEWS) {
      await page
        .locator(APP_SIDEBAR)
        .getByRole("button", { name: label, exact: true })
        .click();
      // Use .first() because some headings (e.g. "Test results") appear at
      // multiple levels (h1 app header, h2 workspace toolbar, h3 section card).
      await expect(
        page.getByRole("heading", { name: heading }).first(),
      ).toBeVisible({
        timeout: 5_000,
      });
    }
  });

  test("view transitions update the URL ?view param", async ({ page }) => {
    await loadWorkspace(page);

    const views = ["catalog", "runs", "overview"] as const;
    for (const view of views) {
      const label =
        NAV_VIEWS.find(
          (v) =>
            v.label.toLowerCase() === view ||
            (v.label === "Overview" && view === "overview"),
        )?.label ?? view.charAt(0).toUpperCase() + view.slice(1);
      await page
        .locator(APP_SIDEBAR)
        .getByRole("button", { name: label, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`[?&]view=${view}`), {
        timeout: 3_000,
      });
    }
  });

  test("child links deep-link to the correct parent state", async ({
    page,
  }) => {
    await loadWorkspace(page);
    await page.getByRole("button", { name: SIDEBAR_EXPAND_LABEL }).click();

    await page
      .locator(APP_SIDEBAR)
      .getByRole("button", { name: "Assets", exact: true })
      .click();
    await expect(page).toHaveURL(/view=catalog/);
    await expect(page).toHaveURL(/tab=summary/);

    await page
      .locator(APP_SIDEBAR)
      .getByRole("button", { name: "Lineage", exact: true })
      .click();
    await expect(page).toHaveURL(/view=catalog/);
    await expect(page).toHaveURL(/tab=lineage/);

    await page
      .locator(APP_SIDEBAR)
      .getByRole("button", { name: "Tests", exact: true })
      .click();
    await expect(page).toHaveURL(/view=runs/);
    await expect(page).toHaveURL(/tab=results/);
    await expect(page).toHaveURL(/kind=tests/);

    await page
      .locator(APP_SIDEBAR)
      .getByRole("button", { name: "Timeline", exact: true })
      .click();
    await expect(page).toHaveURL(/view=runs/);
    await expect(page).toHaveURL(/tab=timeline/);
  });

  test("sidebar collapse toggle hides nav labels and persists to localStorage", async ({
    page,
  }) => {
    await loadWorkspace(page);

    // Sidebar starts collapsed by default (getInitialSidebarCollapsed returns true when no stored value)
    // Expand it first
    await page.getByRole("button", { name: SIDEBAR_EXPAND_LABEL }).click();
    // After expanding, the collapse button should appear
    await expect(
      page.getByRole("button", { name: SIDEBAR_COLLAPSE_LABEL }),
    ).toBeVisible();

    // Collapse it
    await page.getByRole("button", { name: SIDEBAR_COLLAPSE_LABEL }).click();
    await expect(
      page.getByRole("button", { name: SIDEBAR_EXPAND_LABEL }),
    ).toBeVisible();

    // Verify localStorage persistence
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("dbt-tools.sidebarCollapsed"),
    );
    expect(stored).toBe("true");
  });

  test("collapsed sidebar hides child links", async ({ page }) => {
    await loadWorkspace(page);
    await expect(
      page
        .locator(APP_SIDEBAR)
        .getByRole("button", { name: "Assets", exact: true }),
    ).not.toBeVisible();
    await expect(
      page
        .locator(APP_SIDEBAR)
        .getByRole("button", { name: "Timeline", exact: true }),
    ).not.toBeVisible();
  });

  test("sidebar expanded state persists across reload", async ({ page }) => {
    await loadWorkspace(page);

    // Expand sidebar
    await page.getByRole("button", { name: SIDEBAR_EXPAND_LABEL }).click();
    await expect(
      page.getByRole("button", { name: SIDEBAR_COLLAPSE_LABEL }),
    ).toBeVisible();

    // Reload — sidebar should still be expanded
    await page.reload();
    await expect(
      page
        .locator(APP_SIDEBAR)
        .getByRole("button", { name: "Overview", exact: true }),
    ).toBeEnabled({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: SIDEBAR_COLLAPSE_LABEL }),
    ).toBeVisible();
  });

  test("browser back button restores previous view", async ({ page }) => {
    await loadWorkspace(page);

    // Use the sidebar nav label selector to avoid matching tree branch buttons
    await page
      .locator(APP_SIDEBAR)
      .getByRole("button", { name: "Catalog", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Catalog workspace" }),
    ).toBeVisible();

    // Navigate to Runs via the sidebar.
    await page
      .locator(APP_SIDEBAR)
      .getByRole("button", { name: "Runs", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: HEADING_RUN_ANALYSIS }),
    ).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`[?&]view=catalog`));
  });

  test("direct URL with ?view=runs&tab=timeline loads correct view", async ({
    page,
  }) => {
    await loadWorkspace(page);
    await page.goto(`/?view=runs&tab=timeline`);
    await expect(
      page
        .locator(APP_SIDEBAR)
        .getByRole("button", { name: "Runs", exact: true }),
    ).toBeEnabled({ timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: HEADING_RUN_ANALYSIS }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("tab", { name: "Timeline" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
