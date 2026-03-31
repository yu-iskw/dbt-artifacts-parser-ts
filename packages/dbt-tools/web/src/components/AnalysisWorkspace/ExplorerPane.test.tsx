// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { ResourceNode } from "@web/types";
import {
  EXPLORER_UI_COPY,
  ExplorerTreeTestStatsGroup,
  ResourceTypeSummaryBar,
} from "./ExplorerPane";

function makeModel(
  uniqueId: string,
  statusTone: "positive" | "neutral" | "warning" | "danger",
): ResourceNode {
  return {
    uniqueId,
    name: uniqueId,
    resourceType: "model",
    packageName: "pkg",
    path: `models/${uniqueId}.sql`,
    statusTone,
  } as ResourceNode;
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe("EXPLORER_UI_COPY", () => {
  it("distinguishes executed assets from dbt test totals in summary copy", () => {
    expect(EXPLORER_UI_COPY.resourceTypeSummaryAriaLabel.toLowerCase()).toMatch(
      /not dbt test/,
    );
    expect(EXPLORER_UI_COPY.resourceTypeSummaryTitle.toLowerCase()).toMatch(
      /not dbt test/,
    );
  });

  it("explains folder test rollup in tree copy", () => {
    expect(EXPLORER_UI_COPY.treeTestStatsTitle.toLowerCase()).toMatch(
      /dbt test/,
    );
    expect(EXPLORER_UI_COPY.treeTestStatsTitle.toLowerCase()).toMatch(
      /circle|negative/,
    );
    expect(EXPLORER_UI_COPY.treeTestStatsBranchAriaLabel.toLowerCase()).toMatch(
      /rollup/,
    );
    expect(EXPLORER_UI_COPY.treeTestStatsBranchAriaLabel.toLowerCase()).toMatch(
      /circle|minus/,
    );
  });
});

describe("ResourceTypeSummaryBar", () => {
  let container: HTMLElement;
  let root: Root;

  afterEach(() => {
    if (root && container.parentNode) cleanup(root, container);
  });

  it("returns null when there are no executed non-test assets", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ResourceTypeSummaryBar resources={[makeModel("m1", "neutral")]} />,
      );
    });
    expect(container.querySelector(".resource-type-summary")).toBeNull();
  });

  it("exposes an aria-label that states counts are not dbt test totals", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ResourceTypeSummaryBar resources={[makeModel("m1", "positive")]} />,
      );
    });
    const bar = container.querySelector(".resource-type-summary");
    expect(bar).not.toBeNull();
    const label = bar?.getAttribute("aria-label") ?? "";
    expect(label.toLowerCase()).toContain("not dbt test");
    expect(bar?.getAttribute("title")).toBe(
      EXPLORER_UI_COPY.resourceTypeSummaryTitle,
    );
  });

  it("sets per-type item title for executed asset outcomes", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ResourceTypeSummaryBar resources={[makeModel("m1", "positive")]} />,
      );
    });
    const item = container.querySelector(".resource-type-summary__item");
    const title = item?.getAttribute("title") ?? "";
    expect(title.toLowerCase()).toContain("not dbt test");
  });
});

describe("ExplorerTreeTestStatsGroup", () => {
  let container: HTMLElement;
  let root: Root;

  afterEach(() => {
    if (root && container.parentNode) cleanup(root, container);
  });

  it("renders nothing when there are no test stats", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ExplorerTreeTestStatsGroup
          testStats={{
            pass: 0,
            fail: 0,
            error: 0,
            warn: 0,
            skipped: 0,
          }}
          variant="branch"
        />,
      );
    });
    expect(container.textContent?.trim()).toBe("");
  });

  it("shows a visible Tests label and branch aria-label", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ExplorerTreeTestStatsGroup
          testStats={{
            pass: 2,
            fail: 0,
            error: 1,
            warn: 0,
            skipped: 0,
          }}
          variant="branch"
        />,
      );
    });
    expect(container.textContent).toContain("Tests");
    expect(container.textContent).toContain("✓2");
    expect(container.textContent).toContain("✗1");
    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute("aria-label")).toBe(
      EXPLORER_UI_COPY.treeTestStatsBranchAriaLabel,
    );
    expect(group?.getAttribute("title")).toBe(
      EXPLORER_UI_COPY.treeTestStatsTitle,
    );
  });

  it("uses leaf aria-label for resource rows", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ExplorerTreeTestStatsGroup
          testStats={{
            pass: 1,
            fail: 0,
            error: 0,
            warn: 0,
            skipped: 0,
          }}
          variant="leaf"
        />,
      );
    });
    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute("aria-label")).toBe(
      EXPLORER_UI_COPY.treeTestStatsLeafAriaLabel,
    );
  });

  it("shows warn and skipped badges without red X when no errors", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ExplorerTreeTestStatsGroup
          testStats={{
            pass: 0,
            fail: 0,
            error: 0,
            warn: 2,
            skipped: 3,
          }}
          variant="branch"
        />,
      );
    });
    expect(container.textContent).toContain("!2");
    expect(container.textContent).toContain("○3");
    expect(container.textContent).not.toContain("\u2212");
    expect(container.textContent).not.toContain("✗");
    const skipped = container.querySelector(
      ".explorer-tree__test-stat--skipped",
    );
    expect(skipped?.getAttribute("title")).toBe(
      EXPLORER_UI_COPY.treeTestStatSkippedTitle(3),
    );
  });

  it("sets per-segment titles for pass and error stats", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ExplorerTreeTestStatsGroup
          testStats={{
            pass: 5,
            fail: 0,
            error: 2,
            warn: 0,
            skipped: 0,
          }}
          variant="branch"
        />,
      );
    });
    expect(
      container
        .querySelector(".explorer-tree__test-stat--pass")
        ?.getAttribute("title"),
    ).toBe(EXPLORER_UI_COPY.treeTestStatPassTitle(5));
    expect(
      container
        .querySelector(".explorer-tree__test-stat--fail")
        ?.getAttribute("title"),
    ).toBe(EXPLORER_UI_COPY.treeTestStatErrorTitle(2));
  });
});
