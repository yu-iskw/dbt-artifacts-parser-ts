import { expect, type Page } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MANIFEST_PATH = path.resolve(
  __dirname,
  "../../../../dbt-artifacts-parser/resources/manifest/v12/jaffle_shop/manifest_1.10.json",
);
export const RUN_RESULTS_PATH = path.resolve(
  __dirname,
  "../../../../dbt-artifacts-parser/resources/run_results/v6/jaffle_shop/run_results.json",
);

/**
 * Intercept the two preload API endpoints and serve canonical fixture files.
 * Call this BEFORE page.goto("/") so the routes are registered before the app
 * mounts and the useAnalysisPreload hook fires.
 */
export async function mockPreload(page: Page) {
  await page.route("**/api/manifest.json", (route) =>
    route.fulfill({ path: MANIFEST_PATH, contentType: "application/json" }),
  );
  await page.route("**/api/run_results.json", (route) =>
    route.fulfill({ path: RUN_RESULTS_PATH, contentType: "application/json" }),
  );
}

/**
 * Navigate to "/" with preload mocked, then wait until the workspace is ready
 * (sidebar nav buttons enabled = analysis successfully loaded).
 */
export async function loadWorkspace(page: Page) {
  await mockPreload(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Overview", exact: true }),
  ).toBeEnabled({
    timeout: 30_000,
  });
}
