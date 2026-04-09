import path from "path";
import { fileURLToPath } from "url";
import { expect, test } from "@playwright/test";
import { loadWorkspace } from "./helpers/preload";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Matches CI upload path and PR comment markdown (gitignored). */
const prVisualDir = path.join(__dirname, "../test-results/pr-visual");

/**
 * Capture-only screenshots for the PR UI workflow (`RUN_PR_COMMENT_CAPTURE=1`).
 * Not a pixel baseline: images are uploaded to object storage and inlined in a PR comment.
 */
test.describe("PR comment capture @pr-capture", () => {
  test("writes Health and Timeline PNGs for CI", async ({ page }) => {
    await loadWorkspace(page);
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: "Health" }).first(),
    ).toBeVisible();

    await main.screenshot({
      path: path.join(prVisualDir, "health-overview.png"),
      animations: "disabled",
    });

    await page.getByRole("button", { name: "Timeline", exact: true }).click();
    await expect(
      main.getByRole("heading", { name: "Timeline" }).first(),
    ).toBeVisible();

    await main.screenshot({
      path: path.join(prVisualDir, "timeline-main.png"),
      animations: "disabled",
    });
  });
});
