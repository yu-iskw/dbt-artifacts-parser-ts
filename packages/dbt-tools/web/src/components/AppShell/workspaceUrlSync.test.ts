import { describe, expect, it } from "vitest";
import {
  applySearchToWorkspaceState,
  buildNextUrlFromWorkspaceState,
  createInitialNavigationState,
  mergeTimelineSelection,
} from "./workspaceUrlSync";
import type {
  AssetViewState,
  LineageViewState,
  RunsViewState,
  TimelineFilterState,
} from "@web/lib/analysis-workspace/types";

const baseAsset = (): AssetViewState => ({
  activeTab: "summary",
  expandedNodeIds: new Set(["a"]),
  explorerMode: "project",
  status: "all",
  resourceTypes: new Set(),
  materializationKinds: new Set(),
  resourceQuery: "",
  selectedResourceId: null,
  upstreamDepth: 2,
  downstreamDepth: 2,
  allDepsMode: false,
  lensMode: "type",
  activeLegendKeys: new Set(),
});

const baseRuns = (): RunsViewState => ({
  kind: "all",
  status: "all",
  query: "",
  resourceTypes: new Set(),
  materializationKinds: new Set(),
  threadIds: new Set(),
  durationBand: "all",
  sortBy: "attention",
  sortDirection: "desc",
  groupBy: "none",
  selectedExecutionId: null,
  showAdapterMetrics: true,
});

const baseLineage = (): LineageViewState => ({
  rootResourceId: null,
  selectedResourceId: null,
  upstreamDepth: 2,
  downstreamDepth: 2,
  allDepsMode: false,
  lensMode: "type",
  activeLegendKeys: new Set(),
});

describe("createInitialNavigationState", () => {
  it("defaults to health when view is missing", () => {
    const s = createInitialNavigationState("");
    expect(s.activeView).toBe("health");
    expect(s.discoverWorkspaceQuery).toBe("");
  });

  it("parses discover view and q", () => {
    const s = createInitialNavigationState("?view=discover&q=orders");
    expect(s.activeView).toBe("discover");
    expect(s.discoverWorkspaceQuery).toBe("orders");
  });

  it("maps runs+tab=timeline to timeline and reads selected for timeline", () => {
    const s = createInitialNavigationState(
      "?view=runs&tab=timeline&selected=exec-1",
    );
    expect(s.activeView).toBe("timeline");
    expect(s.timelineFilters.selectedExecutionId).toBe("exec-1");
    expect(s.runsViewState.selectedExecutionId).toBeNull();
  });

  it("maps lineage view to inventory with lineage tab", () => {
    const s = createInitialNavigationState("?view=lineage&resource=m1");
    expect(s.activeView).toBe("inventory");
    expect(s.assetViewState.activeTab).toBe("lineage");
    expect(s.assetViewState.selectedResourceId).toBe("m1");
  });

  it("parses runs kind and selected execution", () => {
    const s = createInitialNavigationState(
      "?view=runs&kind=models&selected=run-9",
    );
    expect(s.activeView).toBe("runs");
    expect(s.runsViewState.kind).toBe("models");
    expect(s.runsViewState.selectedExecutionId).toBe("run-9");
  });

  it("parses adapter=1 for runs warehouse metric columns", () => {
    const s = createInitialNavigationState("?view=runs&adapter=1");
    expect(s.activeView).toBe("runs");
    expect(s.runsViewState.showAdapterMetrics).toBe(true);
  });

  it("defaults showAdapterMetrics true when adapter param absent on runs", () => {
    const s = createInitialNavigationState("?view=runs");
    expect(s.runsViewState.showAdapterMetrics).toBe(true);
  });

  it("parses adapter=0 to hide runs warehouse metric columns", () => {
    const s = createInitialNavigationState("?view=runs&adapter=0");
    expect(s.activeView).toBe("runs");
    expect(s.runsViewState.showAdapterMetrics).toBe(false);
  });

  it("supports settings as an initial destination", () => {
    const s = createInitialNavigationState("?view=settings");
    expect(s.activeView).toBe("settings");
  });
});

describe("applySearchToWorkspaceState", () => {
  it("does not return activeView when parse fails", () => {
    const r = applySearchToWorkspaceState("?view=invalid");
    expect(r.activeView).toBeUndefined();
    expect(r.discoverWorkspaceQuery).toBe("");
  });

  it("returns discoverWorkspaceQuery for discover view", () => {
    const r = applySearchToWorkspaceState("?view=discover&q=stg_orders");
    expect(r.activeView).toBe("discover");
    expect(r.discoverWorkspaceQuery).toBe("stg_orders");
  });

  it("merges asset and investigation like popstate", () => {
    const r = applySearchToWorkspaceState(
      "?view=inventory&resource=node-x&assetTab=sql",
    );
    const next = r.assetViewState({
      ...baseAsset(),
      activeTab: "lineage",
      selectedResourceId: "old",
    });
    expect(next.selectedResourceId).toBe("node-x");
    expect(next.activeTab).toBe("sql");
    expect(next.expandedNodeIds.has("a")).toBe(true);
  });

  it("clears runs selected when view is inventory", () => {
    const r = applySearchToWorkspaceState("?view=inventory");
    const runs = r.runsViewState({
      ...baseRuns(),
      selectedExecutionId: "was-set",
      kind: "tests",
    });
    expect(runs.selectedExecutionId).toBeNull();
    expect(runs.kind).toBe("tests");
  });

  it("sets timeline selected only for timeline view", () => {
    const r = applySearchToWorkspaceState(
      "?view=runs&tab=timeline&selected=e1",
    );
    expect(r.activeView).toBe("timeline");
    const tl = r.timelineFilters({
      query: "q",
      activeStatuses: new Set(),
      activeTypes: new Set(),
      selectedExecutionId: null,
      showTests: false,
      failuresOnly: false,
      dependencyDirection: "both",
      dependencyDepthHops: 2,
      timeWindow: null,
      neighborhoodRowsShowAll: false,
    });
    expect(tl.selectedExecutionId).toBe("e1");
    expect(tl.query).toBe("q");
  });

  it("resets neighborhoodRowsShowAll when timeline selected changes via URL", () => {
    const r = applySearchToWorkspaceState("?view=timeline&selected=b");
    const tl = r.timelineFilters({
      query: "",
      activeStatuses: new Set(),
      activeTypes: new Set(),
      selectedExecutionId: "a",
      showTests: false,
      failuresOnly: false,
      dependencyDirection: "both",
      dependencyDepthHops: 2,
      timeWindow: null,
      neighborhoodRowsShowAll: true,
    });
    expect(tl.selectedExecutionId).toBe("b");
    expect(tl.neighborhoodRowsShowAll).toBe(false);
  });

  it("preserves neighborhoodRowsShowAll when timeline selected unchanged from URL", () => {
    const r = applySearchToWorkspaceState("?view=timeline&selected=a");
    const tl = r.timelineFilters({
      query: "",
      activeStatuses: new Set(),
      activeTypes: new Set(),
      selectedExecutionId: "a",
      showTests: false,
      failuresOnly: false,
      dependencyDirection: "both",
      dependencyDepthHops: 2,
      timeWindow: null,
      neighborhoodRowsShowAll: true,
    });
    expect(tl.neighborhoodRowsShowAll).toBe(true);
  });

  it("preserves investigation sourceLens", () => {
    const r = applySearchToWorkspaceState("?view=health");
    const inv = r.investigationSelection({
      selectedResourceId: null,
      selectedExecutionId: null,
      sourceLens: "runs",
    });
    expect(inv.sourceLens).toBe("runs");
  });

  it("applies showAdapterMetrics from URL on runs view", () => {
    const r = applySearchToWorkspaceState("?view=runs&adapter=true");
    const runs = r.runsViewState({
      ...baseRuns(),
      showAdapterMetrics: false,
    });
    expect(runs.showAdapterMetrics).toBe(true);
  });

  it("sets showAdapterMetrics true when adapter param absent on runs", () => {
    const r = applySearchToWorkspaceState("?view=runs");
    const runs = r.runsViewState({
      ...baseRuns(),
      showAdapterMetrics: false,
    });
    expect(runs.showAdapterMetrics).toBe(true);
  });

  it("applies adapter=0 to hide warehouse metrics on runs view", () => {
    const r = applySearchToWorkspaceState("?view=runs&adapter=0");
    const runs = r.runsViewState({
      ...baseRuns(),
      showAdapterMetrics: true,
    });
    expect(runs.showAdapterMetrics).toBe(false);
  });

  it("preserves showAdapterMetrics when navigating to inventory", () => {
    const r = applySearchToWorkspaceState("?view=inventory");
    const runs = r.runsViewState({
      ...baseRuns(),
      showAdapterMetrics: true,
    });
    expect(runs.showAdapterMetrics).toBe(true);
  });
});

const baseTimelineFilters = (): TimelineFilterState => ({
  query: "",
  activeStatuses: new Set(),
  activeTypes: new Set(),
  selectedExecutionId: "a",
  showTests: false,
  failuresOnly: false,
  dependencyDirection: "both",
  dependencyDepthHops: 2,
  timeWindow: null,
  neighborhoodRowsShowAll: true,
});

describe("mergeTimelineSelection", () => {
  it("resets neighborhoodRowsShowAll when selected execution changes", () => {
    const next = mergeTimelineSelection(baseTimelineFilters(), "b");
    expect(next.selectedExecutionId).toBe("b");
    expect(next.neighborhoodRowsShowAll).toBe(false);
  });

  it("preserves neighborhoodRowsShowAll when selected execution unchanged", () => {
    const next = mergeTimelineSelection(baseTimelineFilters(), "a");
    expect(next.neighborhoodRowsShowAll).toBe(true);
  });
});

describe("buildNextUrlFromWorkspaceState", () => {
  const inv = (over: Partial<AssetViewState> = {}): AssetViewState => ({
    ...baseAsset(),
    ...over,
  });

  it("clears inventory params on health", () => {
    const url = buildNextUrlFromWorkspaceState({
      pathname: "/analyze",
      hash: "",
      activeView: "health",
      discoverWorkspaceQuery: "",
      assetViewState: inv({ selectedResourceId: "x", activeTab: "lineage" }),
      runsViewState: baseRuns(),
      timelineSelectedExecutionId: null,
      lineageViewState: baseLineage(),
    });
    expect(url).toBe("/analyze?view=health");
  });

  it("serializes inventory summary with resource", () => {
    const url = buildNextUrlFromWorkspaceState({
      pathname: "/",
      hash: "",
      activeView: "inventory",
      discoverWorkspaceQuery: "",
      assetViewState: inv({
        selectedResourceId: "m.project.model.foo",
        activeTab: "summary",
      }),
      runsViewState: baseRuns(),
      timelineSelectedExecutionId: null,
      lineageViewState: baseLineage(),
    });
    expect(url).toContain("view=inventory");
    expect(url).toContain("resource=m.project.model.foo");
    expect(url).toContain("assetTab=summary");
    expect(url).not.toContain("selected=");
  });

  it("serializes lineage tab params", () => {
    const url = buildNextUrlFromWorkspaceState({
      pathname: "/",
      hash: "#h",
      activeView: "inventory",
      discoverWorkspaceQuery: "",
      assetViewState: inv({ activeTab: "lineage" }),
      runsViewState: baseRuns(),
      timelineSelectedExecutionId: null,
      lineageViewState: {
        ...baseLineage(),
        selectedResourceId: "sel-1",
        upstreamDepth: 3,
        downstreamDepth: 1,
        allDepsMode: true,
        lensMode: "status",
      },
    });
    expect(url).toContain("assetTab=lineage");
    expect(url).toContain("selected=sel-1");
    expect(url).toContain("up=3");
    expect(url).toContain("down=1");
    expect(url).toContain("allDeps=1");
    expect(url).toContain("lens=status");
    expect(url.endsWith("#h")).toBe(true);
  });

  it("serializes runs kind and selected", () => {
    const url = buildNextUrlFromWorkspaceState({
      pathname: "/x",
      hash: "",
      activeView: "runs",
      discoverWorkspaceQuery: "",
      assetViewState: inv(),
      runsViewState: {
        ...baseRuns(),
        kind: "tests",
        selectedExecutionId: "ex-2",
      },
      timelineSelectedExecutionId: null,
      lineageViewState: baseLineage(),
    });
    expect(url).toContain("view=runs");
    expect(url).toContain("kind=tests");
    expect(url).toContain("selected=ex-2");
  });

  it("omits adapter param when showAdapterMetrics is true (default-on)", () => {
    const url = buildNextUrlFromWorkspaceState({
      pathname: "/x",
      hash: "",
      activeView: "runs",
      discoverWorkspaceQuery: "",
      assetViewState: inv(),
      runsViewState: {
        ...baseRuns(),
        showAdapterMetrics: true,
      },
      timelineSelectedExecutionId: null,
      lineageViewState: baseLineage(),
    });
    expect(url).toContain("view=runs");
    expect(url).not.toContain("adapter=");
  });

  it("serializes adapter=0 when showAdapterMetrics is false", () => {
    const url = buildNextUrlFromWorkspaceState({
      pathname: "/x",
      hash: "",
      activeView: "runs",
      discoverWorkspaceQuery: "",
      assetViewState: inv(),
      runsViewState: {
        ...baseRuns(),
        showAdapterMetrics: false,
      },
      timelineSelectedExecutionId: null,
      lineageViewState: baseLineage(),
    });
    expect(url).toContain("adapter=0");
  });

  it("serializes timeline selected and drops kind", () => {
    const url = buildNextUrlFromWorkspaceState({
      pathname: "/",
      hash: "",
      activeView: "timeline",
      discoverWorkspaceQuery: "",
      assetViewState: inv(),
      runsViewState: baseRuns(),
      timelineSelectedExecutionId: "t-1",
      lineageViewState: baseLineage(),
    });
    expect(url).toContain("view=timeline");
    expect(url).toContain("selected=t-1");
    expect(url).not.toContain("kind=");
  });

  it("serializes the settings view without extra navigation params", () => {
    const url = buildNextUrlFromWorkspaceState({
      pathname: "/",
      hash: "",
      activeView: "settings",
      discoverWorkspaceQuery: "",
      assetViewState: inv({ selectedResourceId: "x", activeTab: "lineage" }),
      runsViewState: {
        ...baseRuns(),
        kind: "tests",
        selectedExecutionId: "ex-2",
      },
      timelineSelectedExecutionId: "t-1",
      lineageViewState: baseLineage(),
    });
    expect(url).toBe("/?view=settings");
  });

  it("serializes discover view with q", () => {
    const url = buildNextUrlFromWorkspaceState({
      pathname: "/",
      hash: "",
      activeView: "discover",
      discoverWorkspaceQuery: "orders",
      assetViewState: inv({ selectedResourceId: "x", activeTab: "lineage" }),
      runsViewState: baseRuns(),
      timelineSelectedExecutionId: null,
      lineageViewState: baseLineage(),
    });
    expect(url).toContain("view=discover");
    expect(url).toContain("q=orders");
    expect(url).not.toContain("resource=");
  });
});
