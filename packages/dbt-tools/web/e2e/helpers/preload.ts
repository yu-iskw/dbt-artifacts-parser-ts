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
export const CATALOG_PATH = path.resolve(
  __dirname,
  "../../../../dbt-artifacts-parser/resources/catalog/v1/jaffle_shop/catalog_1.11.json",
);
export const SOURCES_PATH = path.resolve(__dirname, "../fixtures/sources.json");

function managedPreloadStatus() {
  return {
    mode: "preload",
    currentSource: "preload",
    label: "Live target",
    checkedAtMs: 1,
    remoteProvider: null,
    remoteLocation: null,
    pollIntervalMs: null,
    currentRun: null,
    pendingRun: null,
    supportsSwitch: false,
  };
}

/** Register `/api/*` mocks on a single page (reliable with Vite preview; use before `goto`). */
async function registerApiMocksOnPage(
  page: Page,
  options?: {
    catalogPath?: string;
    sourcesPath?: string;
  },
) {
  await page.route("**/api/artifact-source", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fulfill({ status: 405 });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(managedPreloadStatus()),
    });
  });
  await page.route("**/api/artifacts/current/manifest.json", (route) =>
    route.fulfill({ path: MANIFEST_PATH, contentType: "application/json" }),
  );
  await page.route("**/api/artifacts/current/run_results.json", (route) =>
    route.fulfill({ path: RUN_RESULTS_PATH, contentType: "application/json" }),
  );
  await page.route("**/api/artifacts/current/catalog.json", (route) =>
    options?.catalogPath
      ? route.fulfill({
          path: options.catalogPath,
          contentType: "application/json",
        })
      : route.fulfill({ status: 404 }),
  );
  await page.route("**/api/artifacts/current/sources.json", (route) =>
    options?.sourcesPath
      ? route.fulfill({
          path: options.sourcesPath,
          contentType: "application/json",
        })
      : route.fulfill({ status: 404 }),
  );
  await page.route("**/api/manifest.json", (route) =>
    route.fulfill({ path: MANIFEST_PATH, contentType: "application/json" }),
  );
  await page.route("**/api/run_results.json", (route) =>
    route.fulfill({ path: RUN_RESULTS_PATH, contentType: "application/json" }),
  );
  await page.route("**/api/catalog.json", (route) =>
    options?.catalogPath
      ? route.fulfill({
          path: options.catalogPath,
          contentType: "application/json",
        })
      : route.fulfill({ status: 404 }),
  );
  await page.route("**/api/sources.json", (route) =>
    options?.sourcesPath
      ? route.fulfill({
          path: options.sourcesPath,
          contentType: "application/json",
        })
      : route.fulfill({ status: 404 }),
  );
}

/**
 * Attach mocks to every {@link Page} already attached to the context.
 * New pages created later still need {@link mockPreload} before their first app navigation.
 */
export async function mockPreloadContext(context: BrowserContext) {
  await Promise.all(context.pages().map((p) => registerApiMocksOnPage(p)));
}

export async function mockPreload(
  page: Page,
  options?: {
    catalogPath?: string;
    sourcesPath?: string;
  },
) {
  await registerApiMocksOnPage(page, options);
}

/**
 * Navigate to "/" with preload mocked, then wait until the workspace is ready
 * (sidebar nav buttons enabled = analysis successfully loaded).
 */
export async function loadWorkspace(
  page: Page,
  options?: {
    catalogPath?: string;
    sourcesPath?: string;
  },
) {
  await registerApiMocksOnPage(page, options);
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
  await expect(page.locator(".error-banner")).toHaveCount(0);
}
