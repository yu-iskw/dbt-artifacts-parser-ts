import { describe, expect, it } from "vitest";
import {
  applySearchToWorkspaceState,
  buildNextUrlFromWorkspaceState,
  createInitialNavigationState,
} from "./workspaceUrlSync";
import type {
  AssetViewState,
  LineageViewState,
  RunsViewState,
} from "@web/lib/analysis-workspace/types";

const baseAsset = (): AssetViewState => ({
  activeTab: "summary",
  expandedNodeIds: new Set(["a"]),
  explorerMode: "project",
  status: "all",
  resourceTypes: new Set(),
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
  threadIds: new Set(),
  durationBand: "all",
  sortBy: "attention",
  groupBy: "none",
  selectedExecutionId: null,
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
});

describe("applySearchToWorkspaceState", () => {
  it("does not return activeView when parse fails", () => {
    const r = applySearchToWorkspaceState("?view=invalid");
    expect(r.activeView).toBeUndefined();
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
    });
    expect(tl.selectedExecutionId).toBe("e1");
    expect(tl.query).toBe("q");
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

  it("serializes timeline selected and drops kind", () => {
    const url = buildNextUrlFromWorkspaceState({
      pathname: "/",
      hash: "",
      activeView: "timeline",
      assetViewState: inv(),
      runsViewState: baseRuns(),
      timelineSelectedExecutionId: "t-1",
      lineageViewState: baseLineage(),
    });
    expect(url).toContain("view=timeline");
    expect(url).toContain("selected=t-1");
    expect(url).not.toContain("kind=");
  });
});
