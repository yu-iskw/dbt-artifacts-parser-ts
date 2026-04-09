import { expect, type Page } from "@playwright/test";

export type CaptureRecipe = {
  prepare: (page: Page) => Promise<void>;
  /** Optional extra UI motion for the demo recording (scroll, tab, etc.). */
  interact?: (page: Page) => Promise<void>;
};

/**
 * Navigation + readiness checks for each capture target id (see capture-rules.json).
 * Uses the same fixture URLs as navigation / explorer E2E specs.
 */
export const CAPTURE_RECIPES: Record<string, CaptureRecipe> = {
  health: {
    prepare: async (page) => {
      await page.goto("/?view=health");
      await expect(
        page.getByRole("heading", { name: "Health" }).first(),
      ).toBeVisible();
    },
  },
  timeline: {
    prepare: async (page) => {
      await page.goto("/?view=timeline");
      await expect(
        page.getByRole("heading", { name: "Timeline" }).first(),
      ).toBeVisible();
    },
  },
  inventory: {
    prepare: async (page) => {
      await page.goto("/?view=inventory");
      await expect(
        page.getByRole("heading", { name: "Inventory" }).first(),
      ).toBeVisible();
    },
  },
  "inventory-lineage": {
    prepare: async (page) => {
      await page.goto(
        "/?view=inventory&resource=model.jaffle_shop.orders&assetTab=lineage",
      );
      await expect(
        page.getByRole("heading", { name: "Lineage graph" }).first(),
      ).toBeVisible();
    },
    interact: async (page) => {
      await page.mouse.wheel(0, 350);
      await expect(
        page.getByRole("heading", { name: "Lineage graph" }).first(),
      ).toBeVisible();
    },
  },
  runs: {
    prepare: async (page) => {
      await page.goto("/?view=runs");
      await expect(
        page.getByRole("heading", { name: "Runs" }).first(),
      ).toBeVisible();
    },
  },
};
