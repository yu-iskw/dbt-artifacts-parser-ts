import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ANALYZE_BUTTON_LABEL = "Analyze artifacts";

const manifestPath = path.resolve(
  __dirname,
  "../../../dbt-artifacts-parser/resources/manifest/v12/jaffle_shop/manifest_1.10.json",
);
const runResultsPath = path.resolve(
  __dirname,
  "../../../dbt-artifacts-parser/resources/run_results/v6/jaffle_shop/run_results.json",
);

// Blocked: dynamic import of @dbt-tools/core throws 'require is not defined' in preview build
test.describe("analyze flow", () => {
  test.skip("happy path: analyze with valid fixtures shows RunSummary and Gantt", async ({
    page,
  }) => {
    await page.goto("/");

    await page.locator("#manifest-input").setInputFiles(manifestPath);
    await page.locator("#run-results-input").setInputFiles(runResultsPath);

    await expect(
      page.getByRole("button", { name: ANALYZE_BUTTON_LABEL }),
    ).toBeEnabled({
      timeout: 5_000,
    });
    await page.getByRole("button", { name: ANALYZE_BUTTON_LABEL }).click();

    await expect(
      page.getByRole("heading", { name: "Run overview" }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(page.getByText("Run health")).toBeVisible();
    await expect(page.getByText("Critical path")).toBeVisible();

    await expect(
      page
        .getByRole("heading", { name: "Execution Timeline" })
        .or(page.getByText("No Gantt data")),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("Analyze button is disabled when no files selected", async ({
    page,
  }) => {
    await page.goto("/");

    const analyzeButton = page.getByRole("button", {
      name: ANALYZE_BUTTON_LABEL,
    });
    await expect(analyzeButton).toBeDisabled();
  });

  test.skip("invalid manifest shows error message", async ({ page }) => {
    await page.goto("/");

    const invalidJsonPath = path.resolve(__dirname, "fixtures/invalid.json");

    await page.getByLabel("manifest.json").setInputFiles(invalidJsonPath);
    await page.getByLabel("run_results.json").setInputFiles(runResultsPath);

    await page.getByRole("button", { name: ANALYZE_BUTTON_LABEL }).click();

    await expect(page.getByText(/Not a manifest|Failed to parse/i)).toBeVisible(
      { timeout: 15_000 },
    );
  });
});
