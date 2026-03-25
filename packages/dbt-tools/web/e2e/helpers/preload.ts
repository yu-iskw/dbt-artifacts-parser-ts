import { expect, type BrowserContext, type Page } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MANIFEST_PATH = path.resolve(
  __dirname,
  "../../../../dbt-artifacts-parser/resources/manifest/v12/jaffle_shop/manifest_1.11.json",
);
export const RUN_RESULTS_PATH = path.resolve(
  __dirname,
  "../../../../dbt-artifacts-parser/resources/run_results/v6/jaffle_shop/run_results_1.11.json",
);

/** Register `/api/*` mocks on a single page (reliable with Vite preview; use before `goto`). */
async function registerApiMocksOnPage(page: Page) {
  await page.route("**/api/manifest.json", (route) =>
    route.fulfill({ path: MANIFEST_PATH, contentType: "application/json" }),
  );
  await page.route("**/api/run_results.json", (route) =>
    route.fulfill({ path: RUN_RESULTS_PATH, contentType: "application/json" }),
  );
}

/**
 * Attach mocks to every {@link Page} already attached to the context.
 * New pages created later still need {@link mockPreload} before their first app navigation.
 */
export async function mockPreloadContext(context: BrowserContext) {
  await Promise.all(context.pages().map((p) => registerApiMocksOnPage(p)));
}

export async function mockPreload(page: Page) {
  await registerApiMocksOnPage(page);
}

/**
 * Navigate to "/" with preload mocked, then wait until the workspace is ready
 * (sidebar nav buttons enabled = analysis successfully loaded).
 */
export async function loadWorkspace(page: Page) {
  await registerApiMocksOnPage(page);
  await page.goto("/");
  const workspaceNav = page.getByRole("navigation", {
    name: "Workspace sections",
  });
  await expect(
    workspaceNav.getByRole("button", { name: "Health" }),
  ).toBeEnabled({
    timeout: 30_000,
  });
  await expect(page.getByRole("main").getByRole("heading").first()).toBeVisible(
    {
      timeout: 10_000,
    },
  );
}
