// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisState } from "@web/types";
import { AppWorkspaceChrome } from "./AppWorkspaceChrome";

vi.mock("../AnalysisWorkspace", () => ({
  AnalysisWorkspace: () => <div data-testid="analysis-workspace" />,
}));

vi.mock("./AppSidebar", () => ({
  AppSidebar: () => <aside data-testid="app-sidebar" />,
}));

vi.mock("@web/hooks/useOmniboxResults", () => ({
  useOmniboxResults: () => [],
}));

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function makeWorkspace() {
  return {
    activeView: "health",
    sidebarCollapsed: false,
    setSidebarCollapsed: vi.fn(),
    sidebarOpen: false,
    setSidebarOpen: vi.fn(),
    overviewFilters: { status: "all", resourceTypes: new Set(), query: "" },
    setOverviewFilters: vi.fn(),
    timelineFilters: {
      query: "",
      activeStatuses: new Set(),
      activeTypes: new Set(),
      selectedExecutionId: null,
      showTests: false,
      failuresOnly: false,
      dependencyDirection: "both",
      dependencyDepthHops: 1,
      timeWindow: null,
    },
    setTimelineFilters: vi.fn(),
    assetViewState: {
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
    },
    setAssetViewState: vi.fn(),
    runsViewState: {
      kind: "all",
      status: "all",
      query: "",
      resourceTypes: new Set(),
      threadIds: new Set(),
      durationBand: "all",
      sortBy: "name",
      groupBy: "none",
      selectedExecutionId: null,
    },
    setRunsViewState: vi.fn(),
    lineageViewState: {
      rootResourceId: null,
      selectedResourceId: null,
      upstreamDepth: 2,
      downstreamDepth: 2,
      allDepsMode: false,
      lensMode: "type",
      activeLegendKeys: new Set(),
    },
    setLineageViewState: vi.fn(),
    searchState: { query: "", recentResourceIds: [], isOpen: false },
    setSearchState: vi.fn(),
    investigationSelection: {
      selectedResourceId: null,
      selectedExecutionId: null,
      sourceLens: null,
    },
    setInvestigationSelection: vi.fn(),
    setNavigationTarget: vi.fn(),
    handleNavigateTo: vi.fn(),
    frameClass: "app-frame",
  };
}

function renderChrome(analysis: AnalysisState | null) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <AppWorkspaceChrome
        workspace={makeWorkspace() as never}
        analysis={analysis}
        analysisSource="preload"
        error={null}
        preloadLoading={false}
        onLoadDifferent={vi.fn()}
        onAnalysis={vi.fn()}
        onError={vi.fn()}
        theme="light"
        themePreference="light"
        setThemePreference={vi.fn()}
        preferences={{
          theme: "light",
          sidebarCollapsedDefault: true,
          timelineDefaults: {
            showTests: false,
            failuresOnly: false,
            dependencyDirection: "both",
            dependencyDepthHops: 2,
          },
          inventoryDefaults: {
            explorerMode: "project",
            lineageLensMode: "type",
            lineageUpstreamDepth: 2,
            lineageDownstreamDepth: 2,
            allDepsMode: false,
          },
        }}
        setPreferences={vi.fn()}
        workspaceSignals={[]}
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

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  document.body.innerHTML = "";
});

describe("AppWorkspaceChrome header", () => {
  it("shows invocation metadata instead of asset and execution stats", () => {
    const analysis = {
      resources: new Array(5).fill(null),
      summary: { total_nodes: 78 },
      invocationId: "abc-123",
      runStartedAt: Date.parse("2024-12-16T07:45:20.000Z"),
    } as unknown as AnalysisState;
    const { container, root } = renderChrome(analysis);

    const headerText =
      container.querySelector(".app-header__context")?.textContent ?? "";

    expect(headerText).toContain("Invocation abc-123");
    expect(headerText).toContain("Dec");
    expect(headerText).not.toContain("assets");
    expect(headerText).not.toContain("executions");
    expect(
      container.querySelector(".app-header__chip-row")?.textContent,
    ).toContain("Live target");

    cleanupRoot(root, container);
  });

  it("omits the metadata block when invocation details are missing", () => {
    const analysis = {
      resources: [],
      summary: { total_nodes: 0 },
      invocationId: null,
      runStartedAt: null,
    } as unknown as AnalysisState;
    const { container, root } = renderChrome(analysis);

    expect(
      container.querySelector(".app-header__context")?.textContent,
    ).toContain("No invocation metadata available");

    cleanupRoot(root, container);
  });

  it("renders the header shell on the settings destination", () => {
    const workspace = {
      ...makeWorkspace(),
      activeView: "settings",
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AppWorkspaceChrome
          workspace={workspace as never}
          analysis={null}
          analysisSource={null}
          error={null}
          preloadLoading={false}
          onLoadDifferent={vi.fn()}
          onAnalysis={vi.fn()}
          onError={vi.fn()}
          theme="light"
          themePreference="system"
          setThemePreference={vi.fn()}
          preferences={{
            theme: "system",
            sidebarCollapsedDefault: true,
            timelineDefaults: {
              showTests: false,
              failuresOnly: false,
              dependencyDirection: "both",
              dependencyDepthHops: 2,
            },
            inventoryDefaults: {
              explorerMode: "project",
              lineageLensMode: "type",
              lineageUpstreamDepth: 2,
              lineageDownstreamDepth: 2,
              allDepsMode: false,
            },
          }}
          setPreferences={vi.fn()}
          workspaceSignals={[]}
        />,
      );
    });

    expect(container.querySelector(".app-header")).not.toBeNull();
    expect(container.textContent).toContain("Settings");

    cleanupRoot(root, container);
  });
});
