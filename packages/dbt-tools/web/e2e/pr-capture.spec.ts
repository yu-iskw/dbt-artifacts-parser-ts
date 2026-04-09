import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import type { CaptureManifest } from "../scripts/resolve-pr-capture-targets";
import { loadWorkspace } from "./helpers/preload";
import { CAPTURE_RECIPES } from "./pr-capture-targets";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, "..");

function defaultManifestPath(): string {
  return path.join(packageDir, "pr-capture-artifacts", "capture-manifest.json");
}

function readManifest(): CaptureManifest {
  const manifestPath = process.env.PR_CAPTURE_MANIFEST ?? defaultManifestPath();
  const raw = fs.readFileSync(manifestPath, "utf8");
  return JSON.parse(raw) as CaptureManifest;
}

function getCaptureOutputRoot(): string {
  return (
    process.env.PR_CAPTURE_OUTPUT ??
    path.join(packageDir, "pr-capture-artifacts")
  );
}

async function defaultInteract(page: Page): Promise<void> {
  await page.mouse.wheel(0, 400);
  await expect(page.getByRole("main")).toBeVisible();
}

test.describe("pr visual capture", () => {
  const manifest = readManifest();
  const outRoot = getCaptureOutputRoot();
  const screenshotsDir = path.join(outRoot, "screenshots");
  const videosDir = path.join(outRoot, "videos");

  test.beforeAll(() => {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    fs.mkdirSync(videosDir, { recursive: true });
  });

  for (const target of manifest.targets) {
    test(`capture ${target.id}`, async ({ page }, testInfo) => {
      const recipe = CAPTURE_RECIPES[target.id];
      if (!recipe) {
        testInfo.skip(true, `Unknown capture target id: ${target.id}`);
        return;
      }

      await loadWorkspace(page);
      await recipe.prepare(page);

      const videoPath = path.join(videosDir, `${target.id}.webm`);
      await page.screencast.start({
        path: videoPath,
        size: { width: 1280, height: 720 },
      });

      const actionsHighlight = await page.screencast.showActions({
        position: "bottom-right",
        duration: 800,
      });

      await page.screencast.showChapter(target.title, {
        description: "Fixture: jaffle_shop (mocked API)",
        duration: 2000,
      });

      if (recipe.interact) {
        await recipe.interact(page);
      } else {
        await defaultInteract(page);
      }

      const pngPath = path.join(screenshotsDir, `${target.id}.png`);
      await page.screenshot({ path: pngPath, fullPage: true });

      await actionsHighlight.dispose();
      await page.screencast.stop();

      expect(fs.statSync(pngPath).size, "screenshot non-empty").toBeGreaterThan(
        1000,
      );
      expect(fs.statSync(videoPath).size, "video non-empty").toBeGreaterThan(
        1000,
      );
    });
  }
});
