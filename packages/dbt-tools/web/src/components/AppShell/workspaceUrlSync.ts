import type {
  AssetViewState,
  InvestigationSelectionState,
  LineageViewState,
  RunsViewState,
  TimelineFilterState,
  WorkspaceView,
} from "@web/lib/analysis-workspace/types";
import {
  buildInitialLineageViewState,
  getInitialAssetTab,
  parseRunsKind,
  parseSelectedExecutionId,
  parseSelectedResourceId,
  parseViewFromSearch,
} from "./appNavigation";

export interface UrlDerivedNavigationState {
  activeView: WorkspaceView;
  assetViewState: AssetViewState;
  runsViewState: RunsViewState;
  timelineFilters: TimelineFilterState;
  lineageViewState: LineageViewState;
  investigationSelection: InvestigationSelectionState;
}

const defaultAssetViewState = (search: string): AssetViewState => ({
  activeTab: getInitialAssetTab(search),
  expandedNodeIds: new Set(),
  explorerMode: "project",
  status: "all",
  resourceTypes: new Set(),
  resourceQuery: "",
  selectedResourceId: parseSelectedResourceId(search),
  upstreamDepth: 2,
  downstreamDepth: 2,
  allDepsMode: false,
  lensMode: "type",
  activeLegendKeys: new Set(),
});

const defaultRunsViewState = (search: string): RunsViewState => {
  const view = parseViewFromSearch(search);
  return {
    kind: parseRunsKind(search) ?? "all",
    status: "all",
    query: "",
    resourceTypes: new Set(),
    threadIds: new Set(),
    durationBand: "all",
    sortBy: "attention",
    groupBy: "none",
    selectedExecutionId:
      view === "runs" ? parseSelectedExecutionId(search) : null,
  };
};

const defaultTimelineFilters = (search: string): TimelineFilterState => {
  const view = parseViewFromSearch(search);
  const selected =
    view === "runs" || view === "timeline"
      ? parseSelectedExecutionId(search)
      : null;
  return {
    query: "",
    activeStatuses: new Set(),
    activeTypes: new Set(),
    selectedExecutionId: selected,
    showTests: false,
    failuresOnly: false,
    dependencyDirection: "both",
    dependencyDepthHops: 2,
    timeWindow: null,
  };
};

const defaultInvestigationSelection = (
  search: string,
): InvestigationSelectionState => {
  const view = parseViewFromSearch(search) ?? "health";
  const resourceId = parseSelectedResourceId(search);
  const selectedParam = parseSelectedExecutionId(search);
  return {
    selectedResourceId: resourceId,
    selectedExecutionId:
      view === "runs" || view === "timeline" ? selectedParam : null,
    sourceLens: null,
  };
};

/** Full URL-derived slices for first paint (matches previous App.tsx initializers). */
export function createInitialNavigationState(
  search: string,
): UrlDerivedNavigationState {
  const activeView = parseViewFromSearch(search) ?? "health";
  return {
    activeView,
    assetViewState: defaultAssetViewState(search),
    runsViewState: defaultRunsViewState(search),
    timelineFilters: defaultTimelineFilters(search),
    lineageViewState: buildInitialLineageViewState(search),
    investigationSelection: defaultInvestigationSelection(search),
  };
}

/**
 * Maps `location.search` to state updates after history navigation (back/forward).
 * When `parseViewFromSearch` returns null, `activeView` is `undefined` and callers should not update active view.
 */
export function applySearchToWorkspaceState(search: string): {
  activeView: WorkspaceView | undefined;
  assetViewState: (current: AssetViewState) => AssetViewState;
  runsViewState: (current: RunsViewState) => RunsViewState;
  timelineFilters: (current: TimelineFilterState) => TimelineFilterState;
  lineageViewState: LineageViewState;
  investigationSelection: (
    current: InvestigationSelectionState,
  ) => InvestigationSelectionState;
} {
  const view = parseViewFromSearch(search);
  const resourceId = parseSelectedResourceId(search);
  const selectedParam = parseSelectedExecutionId(search);

  return {
    activeView: view ?? undefined,
    assetViewState: (current) => ({
      ...current,
      selectedResourceId: resourceId,
      activeTab: getInitialAssetTab(search),
    }),
    runsViewState: (current) => ({
      ...current,
      kind: parseRunsKind(search) ?? current.kind,
      selectedExecutionId: view === "runs" ? selectedParam : null,
    }),
    timelineFilters: (current) => ({
      ...current,
      selectedExecutionId: view === "timeline" ? selectedParam : null,
    }),
    lineageViewState: buildInitialLineageViewState(search),
    investigationSelection: (current) => ({
      ...current,
      selectedResourceId: resourceId,
      selectedExecutionId:
        view === "runs" || view === "timeline" ? selectedParam : null,
      sourceLens: current.sourceLens,
    }),
  };
}

export interface BuildUrlInput {
  pathname: string;
  hash: string;
  activeView: WorkspaceView;
  assetViewState: AssetViewState;
  runsViewState: RunsViewState;
  timelineSelectedExecutionId: string | null;
  lineageViewState: LineageViewState;
}

const NAV_SEARCH_KEYS = [
  "resource",
  "assetTab",
  "selected",
  "kind",
  "up",
  "down",
  "allDeps",
  "lens",
] as const;

function deleteNavSearchKeys(url: URL, except?: ReadonlySet<string>) {
  for (const key of NAV_SEARCH_KEYS) {
    if (except?.has(key)) continue;
    url.searchParams.delete(key);
  }
}

function applyInventoryUrl(
  url: URL,
  assetViewState: AssetViewState,
  lineageViewState: LineageViewState,
) {
  if (assetViewState.selectedResourceId) {
    url.searchParams.set("resource", assetViewState.selectedResourceId);
  } else {
    url.searchParams.delete("resource");
  }
  url.searchParams.set("assetTab", assetViewState.activeTab);
  url.searchParams.delete("kind");
  if (assetViewState.activeTab === "lineage") {
    if (lineageViewState.selectedResourceId) {
      url.searchParams.set("selected", lineageViewState.selectedResourceId);
    } else {
      url.searchParams.delete("selected");
    }
    url.searchParams.set("up", String(lineageViewState.upstreamDepth));
    url.searchParams.set("down", String(lineageViewState.downstreamDepth));
    url.searchParams.set("allDeps", lineageViewState.allDepsMode ? "1" : "0");
    url.searchParams.set("lens", lineageViewState.lensMode);
  } else {
    deleteNavSearchKeys(url, new Set(["resource", "assetTab"]));
  }
}

function applyRunsUrl(url: URL, runsViewState: RunsViewState) {
  url.searchParams.set("kind", runsViewState.kind);
  if (runsViewState.selectedExecutionId) {
    url.searchParams.set("selected", runsViewState.selectedExecutionId);
  } else {
    url.searchParams.delete("selected");
  }
  deleteNavSearchKeys(url, new Set(["kind", "selected"]));
}

function applyTimelineUrl(
  url: URL,
  timelineSelectedExecutionId: string | null,
) {
  if (timelineSelectedExecutionId) {
    url.searchParams.set("selected", timelineSelectedExecutionId);
  } else {
    url.searchParams.delete("selected");
  }
  deleteNavSearchKeys(url, new Set(["selected"]));
}

/** Builds `pathname + search + hash` from workspace slices (matches App.tsx pushState effect). */
export function buildNextUrlFromWorkspaceState(input: BuildUrlInput): string {
  const {
    pathname,
    hash,
    activeView,
    assetViewState,
    runsViewState,
    timelineSelectedExecutionId,
    lineageViewState,
  } = input;

  const url = new URL(`http://local.invalid${pathname}${hash}`);
  url.searchParams.set("view", activeView);

  if (activeView === "inventory") {
    applyInventoryUrl(url, assetViewState, lineageViewState);
  } else if (activeView === "runs") {
    applyRunsUrl(url, runsViewState);
  } else if (activeView === "timeline") {
    applyTimelineUrl(url, timelineSelectedExecutionId);
  } else {
    deleteNavSearchKeys(url);
  }

  return `${pathname}${url.search}${hash}`;
}
