// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisState, ResourceNode } from "@web/types";
import { InventoryView } from "./InventoryView";

const { searchResourcesFromWorker } = vi.hoisted(() => ({
  searchResourcesFromWorker: vi.fn(),
}));

vi.mock("@web/services/analysisLoader", () => ({
  searchResourcesFromWorker,
}));

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeAnalysis(): AnalysisState {
  return {
    summary: {
      total_execution_time: 0,
      total_nodes: 0,
      total_edges: 0,
      nodes_by_status: {},
      type_counts: {},
    },
    bundles: [],
    graph: { nodes: [], edges: [] },
    resources: [],
  } as unknown as AnalysisState;
}

function makeResource(uniqueId: string, name: string): ResourceNode {
  return {
    uniqueId,
    name,
    resourceType: "model",
    packageName: "pkg",
    path: `models/${name}.sql`,
  } as ResourceNode;
}

function renderInventory() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <InventoryView
        analysis={makeAnalysis()}
        resource={null}
        onSelectResource={vi.fn()}
        assetViewState={{
          activeTab: "summary",
          selectedResourceId: null,
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
        onAssetViewStateChange={vi.fn()}
        lineageViewState={{
          rootResourceId: null,
          selectedResourceId: null,
          upstreamDepth: 2,
          downstreamDepth: 2,
          allDepsMode: false,
          lensMode: "type",
          activeLegendKeys: new Set(),
        }}
        onLineageViewStateChange={vi.fn()}
        onInvestigationSelectionChange={vi.fn()}
        onNavigateTo={vi.fn()}
      />,
    );
  });

  return { container, root };
}

function cleanupRoot(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

function changeInput(input: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(input) as HTMLInputElement;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!valueSetter) {
    throw new Error("Input value setter missing");
  }
  valueSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
}

describe("InventoryView lineage search", () => {
  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    document.body.innerHTML = "";
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("ignores stale results when a newer query resolves later", async () => {
    const first = deferred<ResourceNode[]>();
    const second = deferred<ResourceNode[]>();
    searchResourcesFromWorker
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { container, root } = renderInventory();
    const input = container.querySelector(
      "#inventory-lineage-search",
    ) as HTMLInputElement;

    act(() => {
      changeInput(input, "or");
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    await vi.waitFor(() => {
      expect(searchResourcesFromWorker).toHaveBeenCalledTimes(1);
    });

    act(() => {
      changeInput(input, "ord");
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    await vi.waitFor(() => {
      expect(searchResourcesFromWorker).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      first.resolve([makeResource("model.pkg.old", "old_match")]);
      await first.promise;
    });

    expect(container.textContent).not.toContain("old_match");

    await act(async () => {
      second.resolve([makeResource("model.pkg.current", "current_match")]);
      await second.promise;
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("current_match");
      expect(container.textContent).not.toContain("old_match");
    });

    cleanupRoot(root, container);
  });

  it("does not repopulate suggestions after the query is cleared", async () => {
    const pending = deferred<ResourceNode[]>();
    searchResourcesFromWorker.mockReturnValueOnce(pending.promise);

    const { container, root } = renderInventory();
    const input = container.querySelector(
      "#inventory-lineage-search",
    ) as HTMLInputElement;

    act(() => {
      changeInput(input, "orders");
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      changeInput(input, "");
    });
    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    await act(async () => {
      pending.resolve([makeResource("model.pkg.orders", "orders")]);
      await pending.promise;
    });

    expect(container.textContent).not.toContain("orders");
    expect(container.textContent).not.toContain("Searching…");

    cleanupRoot(root, container);
  });
});
