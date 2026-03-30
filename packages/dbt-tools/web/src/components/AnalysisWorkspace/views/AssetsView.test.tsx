// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisState, ResourceNode } from "@web/types";
import { AssetsView } from "./AssetsView";

const { useResourceCode } = vi.hoisted(() => ({
  useResourceCode: vi.fn(),
}));

vi.mock("@web/hooks/useResourceCode", () => ({
  useResourceCode,
}));

vi.mock("../lineage/LineagePanel", () => ({
  LineagePanel: () => (
    <section>
      <h3>Lineage graph</h3>
    </section>
  ),
}));

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function makeResource(overrides: Partial<ResourceNode> = {}): ResourceNode {
  return {
    uniqueId: overrides.uniqueId ?? "model.jaffle_shop.orders",
    name: overrides.name ?? "orders",
    resourceType: overrides.resourceType ?? "model",
    packageName: overrides.packageName ?? "jaffle_shop",
    path: overrides.path ?? "models/marts/orders.sql",
    originalFilePath: overrides.originalFilePath ?? "models/marts/orders.sql",
    patchPath: overrides.patchPath ?? null,
    database: overrides.database ?? "warehouse",
    schema: overrides.schema ?? "analytics",
    description: overrides.description ?? "Order overview.",
    compiledCode: overrides.compiledCode,
    rawCode: overrides.rawCode,
    definition: overrides.definition,
    status: overrides.status ?? "success",
    statusTone: overrides.statusTone ?? "positive",
    executionTime: overrides.executionTime ?? 3.63,
    threadId: overrides.threadId ?? "Thread-1 (worker)",
  } as ResourceNode;
}

function makeAnalysis(resources: ResourceNode[]): AnalysisState {
  return {
    summary: {
      total_execution_time: 0,
      total_nodes: resources.length,
      total_edges: 0,
      nodes_by_status: {},
      type_counts: {},
    },
    bundles: [],
    graph: { nodes: [], edges: [] },
    resourceGroups: [],
    executions: [],
    dependencyIndex: {
      "model.jaffle_shop.orders": {
        upstreamCount: 2,
        downstreamCount: 9,
        upstream: [],
        downstream: [],
      },
      "test.jaffle_shop.orders_not_null": {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: [
          {
            uniqueId: "model.jaffle_shop.orders",
            name: "orders",
            resourceType: "model",
            depth: 1,
          },
        ],
        downstream: [],
      },
      "test.jaffle_shop.orders_unique": {
        upstreamCount: 1,
        downstreamCount: 0,
        upstream: [
          {
            uniqueId: "model.jaffle_shop.orders",
            name: "orders",
            resourceType: "model",
            depth: 1,
          },
        ],
        downstream: [],
      },
    },
    resources,
  } as unknown as AnalysisState;
}

function renderAssetsView({
  resource,
  analysis,
  activeTab = "summary",
}: {
  resource: ResourceNode;
  analysis: AnalysisState;
  activeTab?: "summary" | "lineage" | "sql" | "runtime" | "tests";
}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onSelectResource = vi.fn();
  const onAssetViewStateChange = vi.fn();
  const onLineageViewStateChange = vi.fn();
  const onNavigateTo = vi.fn();

  act(() => {
    root.render(
      <AssetsView
        resource={resource}
        analysis={analysis}
        onSelectResource={onSelectResource}
        assetViewState={{
          activeTab,
          selectedResourceId: resource.uniqueId,
          expandedNodeIds: new Set(),
          explorerMode: "project",
          status: "all",
          resourceTypes: new Set(),
          resourceQuery: "",
          upstreamDepth: 2,
          downstreamDepth: 2,
          allDepsMode: false,
          lensMode: "type",
          activeLegendKeys: new Set(),
        }}
        onAssetViewStateChange={onAssetViewStateChange}
        lineageViewState={{
          rootResourceId: resource.uniqueId,
          selectedResourceId: resource.uniqueId,
          upstreamDepth: 2,
          downstreamDepth: 2,
          allDepsMode: false,
          lensMode: "type",
          activeLegendKeys: new Set(),
        }}
        onLineageViewStateChange={onLineageViewStateChange}
        onNavigateTo={onNavigateTo}
      />,
    );
  });

  return {
    container,
    root,
    onNavigateTo,
  };
}

function cleanupRoot(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe("AssetsView", () => {
  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    useResourceCode.mockReturnValue({
      compiledCode: "select * from orders",
      rawCode: null,
      loading: false,
      error: null,
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders summary, lineage, tests, and sql without a runtime section", () => {
    const resource = makeResource();
    const tests = [
      makeResource({
        uniqueId: "test.jaffle_shop.orders_not_null",
        name: "orders_not_null",
        resourceType: "test",
        path: "target/run/tests/orders_not_null.sql",
        originalFilePath: "tests/orders_not_null.sql",
        status: "pass",
        statusTone: "positive",
        executionTime: 0.4,
        threadId: "Thread-2",
      }),
      makeResource({
        uniqueId: "test.jaffle_shop.orders_unique",
        name: "orders_unique",
        resourceType: "test",
        path: "target/run/tests/orders_unique.sql",
        originalFilePath: "tests/orders_unique.sql",
        status: "fail",
        statusTone: "danger",
        executionTime: 0.9,
        threadId: "Thread-3",
      }),
    ];
    const { container, root } = renderAssetsView({
      resource,
      analysis: makeAnalysis([resource, ...tests]),
    });

    expect(container.textContent).toContain("Asset summary");
    expect(container.textContent).toContain("Lineage graph");
    expect(container.textContent).toContain("SQL");
    expect(container.textContent).toContain("Tests");
    expect(container.textContent).not.toContain("Runtime");
    expect(container.textContent).toContain("Attention needed");
    expect(container.textContent).toContain("Attached tests");
    expect(container.textContent).toContain("orders_not_null");
    expect(container.textContent).toContain("orders_unique");
    expect(container.querySelector(".asset-tests-table__header")).toBeTruthy();
    const sectionIds = [
      ...container.querySelectorAll(".asset-workspace__section"),
    ].map((section) => section.getAttribute("id"));
    expect(sectionIds).toEqual([
      "asset-section-summary",
      "asset-section-lineage",
      "asset-section-tests",
      "asset-section-sql",
    ]);

    cleanupRoot(root, container);
  });

  it("maps the legacy runtime tab to the summary section scroll target", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const resource = makeResource();
    const { container, root } = renderAssetsView({
      resource,
      analysis: makeAnalysis([resource]),
      activeTab: "runtime",
    });

    expect(container.textContent).toContain("Asset summary");
    expect(scrollIntoView).toHaveBeenCalled();

    cleanupRoot(root, container);
  });

  it("defaults to status sorting and keeps attention rows first", () => {
    const resource = makeResource();
    const tests = [
      makeResource({
        uniqueId: "test.jaffle_shop.orders_not_null",
        name: "orders_not_null",
        resourceType: "test",
        path: "target/run/tests/orders_not_null.sql",
        originalFilePath: "tests/orders_not_null.sql",
        status: "pass",
        statusTone: "positive",
        executionTime: 0.4,
      }),
      makeResource({
        uniqueId: "test.jaffle_shop.orders_unique",
        name: "orders_unique",
        resourceType: "test",
        path: "target/run/tests/orders_unique.sql",
        originalFilePath: "tests/orders_unique.sql",
        status: "fail",
        statusTone: "danger",
        executionTime: 0.9,
      }),
    ];
    const { container, root } = renderAssetsView({
      resource,
      analysis: makeAnalysis([resource, ...tests]),
    });

    const rowTitles = [
      ...container.querySelectorAll(".asset-tests-table__cell--test strong"),
    ].map((node) => node.textContent);
    expect(rowTitles).toEqual(["orders_unique", "orders_not_null"]);

    cleanupRoot(root, container);
  });

  it("allows sorting by clicking the test header", () => {
    const resource = makeResource();
    const tests = [
      makeResource({
        uniqueId: "test.jaffle_shop.orders_not_null",
        name: "zzz_test",
        resourceType: "test",
        path: "tests/zzz.sql",
        originalFilePath: "tests/zzz.sql",
        status: "pass",
        statusTone: "positive",
        executionTime: 0.4,
      }),
      makeResource({
        uniqueId: "test.jaffle_shop.orders_unique",
        name: "aaa_test",
        resourceType: "test",
        path: "tests/aaa.sql",
        originalFilePath: "tests/aaa.sql",
        status: "pass",
        statusTone: "positive",
        executionTime: 0.1,
      }),
    ];
    const { container, root } = renderAssetsView({
      resource,
      analysis: makeAnalysis([resource, ...tests]),
    });

    const headerButtons = [
      ...container.querySelectorAll(".asset-tests-table__header button"),
    ].map((button) => button.textContent?.replace(/\s+/g, " ").trim());
    expect(headerButtons).toEqual([
      "Test",
      "Status↓",
      "Type",
      "Duration",
      "Location",
    ]);
    const testHeader = [
      ...container.querySelectorAll(".asset-tests-table__header button"),
    ].find((button) => button.textContent?.includes("Test")) as
      | HTMLButtonElement
      | undefined;
    expect(testHeader).toBeTruthy();

    act(() => {
      testHeader?.click();
    });

    const rowTitles = [
      ...container.querySelectorAll(".asset-tests-table__cell--test strong"),
    ].map((node) => node.textContent);
    expect(rowTitles).toEqual(["aaa_test", "zzz_test"]);

    cleanupRoot(root, container);
  });

  it("allows sorting by clicking the location header", () => {
    const resource = makeResource();
    const tests = [
      makeResource({
        uniqueId: "test.jaffle_shop.orders_not_null",
        name: "pathless_test",
        resourceType: "test",
        path: "",
        originalFilePath: "",
        patchPath: "",
        status: "pass",
        statusTone: "positive",
        executionTime: 0.4,
      }),
      makeResource({
        uniqueId: "test.jaffle_shop.orders_unique",
        name: "models_test",
        resourceType: "test",
        path: "models/marts/orders.yml",
        originalFilePath: "models/marts/orders.yml",
        status: "pass",
        statusTone: "positive",
        executionTime: 0.1,
      }),
    ];
    const { container, root } = renderAssetsView({
      resource,
      analysis: makeAnalysis([resource, ...tests]),
    });

    const locationHeader = [
      ...container.querySelectorAll(".asset-tests-table__header button"),
    ].find((button) => button.textContent?.includes("Location")) as
      | HTMLButtonElement
      | undefined;
    expect(locationHeader).toBeTruthy();

    act(() => {
      locationHeader?.click();
    });

    const rowTitles = [
      ...container.querySelectorAll(".asset-tests-table__cell--test strong"),
    ].map((node) => node.textContent);
    expect(rowTitles).toEqual(["models_test", "pathless_test"]);

    cleanupRoot(root, container);
  });

  it("toggles duration sorting from the header and leaves action unsortable", () => {
    const resource = makeResource();
    const tests = [
      makeResource({
        uniqueId: "test.jaffle_shop.orders_not_null",
        name: "slow_test",
        resourceType: "test",
        path: "tests/slow.sql",
        originalFilePath: "tests/slow.sql",
        status: "pass",
        statusTone: "positive",
        executionTime: 0.9,
      }),
      makeResource({
        uniqueId: "test.jaffle_shop.orders_unique",
        name: "fast_test",
        resourceType: "test",
        path: "tests/fast.sql",
        originalFilePath: "tests/fast.sql",
        status: "pass",
        statusTone: "positive",
        executionTime: 0.1,
      }),
    ];
    const { container, root } = renderAssetsView({
      resource,
      analysis: makeAnalysis([resource, ...tests]),
    });

    const durationHeader = [
      ...container.querySelectorAll(".asset-tests-table__header button"),
    ].find((button) => button.textContent?.includes("Duration")) as
      | HTMLButtonElement
      | undefined;
    expect(durationHeader).toBeTruthy();

    act(() => {
      durationHeader?.click();
    });

    let rowTitles = [
      ...container.querySelectorAll(".asset-tests-table__cell--test strong"),
    ].map((node) => node.textContent);
    expect(rowTitles).toEqual(["slow_test", "fast_test"]);

    act(() => {
      durationHeader?.click();
    });

    rowTitles = [
      ...container.querySelectorAll(".asset-tests-table__cell--test strong"),
    ].map((node) => node.textContent);
    expect(rowTitles).toEqual(["fast_test", "slow_test"]);

    const actionHeader = container
      .querySelectorAll(".asset-tests-table__header [role='columnheader']")
      .item(5);
    expect(actionHeader.textContent?.trim()).toBe("Action");
    expect(actionHeader.querySelector("button")).toBeNull();

    cleanupRoot(root, container);
  });

  it("navigates to runs when a test evidence row is clicked", () => {
    const resource = makeResource();
    const test = makeResource({
      uniqueId: "test.jaffle_shop.orders_not_null",
      name: "orders_not_null",
      resourceType: "test",
      path: "target/run/tests/orders_not_null.sql",
      originalFilePath: "tests/orders_not_null.sql",
      status: "pass",
      statusTone: "positive",
      executionTime: 0.4,
    });
    const { container, root, onNavigateTo } = renderAssetsView({
      resource,
      analysis: makeAnalysis([resource, test]),
    });

    const testRow = container.querySelector(
      ".asset-tests-table__row",
    ) as HTMLButtonElement;
    expect(testRow).toBeTruthy();

    act(() => {
      testRow.click();
    });

    expect(onNavigateTo).toHaveBeenCalledWith("runs", {
      executionId: "test.jaffle_shop.orders_not_null",
    });

    cleanupRoot(root, container);
  });

  it("renders the empty state below the compact summary band", () => {
    const resource = makeResource();
    const { container, root } = renderAssetsView({
      resource,
      analysis: makeAnalysis([resource]),
    });

    expect(container.textContent).toContain("No attached tests");
    expect(container.textContent).toContain(
      "No attached tests were found for this asset in the current artifacts.",
    );
    expect(container.querySelector(".asset-tests-summary")).toBeTruthy();

    cleanupRoot(root, container);
  });
});
