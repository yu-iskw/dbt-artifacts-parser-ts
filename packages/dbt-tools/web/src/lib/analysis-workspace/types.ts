import type { Dispatch, SetStateAction } from "react";
import type { AnalysisState, StatusTone } from "@web/types";

/**
 * New top-level workspace views.
 * Legacy values (overview, catalog, runs) are kept for backward-compat URL
 * redirects and will be removed after all references are migrated.
 */
export type WorkspaceView =
  | "health"
  | "inventory"
  | "runs"
  | "timeline"
  | "lineage"
  // legacy — redirect targets below
  | "overview"
  | "catalog"
  | "execution"
  | "quality"
  | "dependencies"
  | "search";

export type AssetTab = "summary" | "lineage" | "sql" | "runtime" | "tests";
export type RunsKind =
  | "all"
  | "models"
  | "tests"
  | "seeds"
  | "snapshots"
  | "operations";
export type RunsSortBy = "attention" | "duration" | "name" | "status" | "start";
export type RunsGroupBy = "none" | "type" | "status" | "thread";

export type DashboardStatusFilter = "all" | StatusTone;
export type AssetExplorerMode = "project" | "database";
export type LensMode = "status" | "type" | "coverage";

export interface OverviewFilterState {
  status: DashboardStatusFilter;
  resourceTypes: Set<string>;
  query: string;
}

export interface ResultsFilterState {
  status: DashboardStatusFilter;
  query: string;
}

export interface TimelineFilterState {
  query: string;
  activeStatuses: Set<string>;
  activeTypes: Set<string>;
  selectedExecutionId: string | null;
}

export interface AssetViewState {
  activeTab: AssetTab;
  selectedResourceId: string | null;
  explorerMode: AssetExplorerMode;
  status: DashboardStatusFilter;
  resourceTypes: Set<string>;
  resourceQuery: string;
  upstreamDepth: number;
  downstreamDepth: number;
  allDepsMode: boolean;
  lensMode: LensMode;
  activeLegendKeys: Set<string>;
}

export interface RunsViewState {
  kind: RunsKind;
  status: DashboardStatusFilter;
  query: string;
  resourceTypes: Set<string>;
  threadIds: Set<string>;
  durationBand: "all" | "fast" | "medium" | "slow";
  sortBy: RunsSortBy;
  groupBy: RunsGroupBy;
  selectedExecutionId: string | null;
}

export interface LineageViewState {
  rootResourceId: string | null;
  selectedResourceId: string | null;
  upstreamDepth: number;
  downstreamDepth: number;
  allDepsMode: boolean;
  lensMode: LensMode;
  activeLegendKeys: Set<string>;
}

export interface SearchState {
  query: string;
  recentResourceIds: string[];
  isOpen: boolean;
}

export interface InvestigationSelectionState {
  selectedResourceId: string | null;
  selectedExecutionId: string | null;
  sourceLens: WorkspaceView | null;
}

export interface WorkspaceSignal {
  label: string;
  value: string;
  detail: string;
  tone: string;
}

export interface AnalysisWorkspaceProps {
  analysis: AnalysisState;
  activeView: WorkspaceView;
  analysisSource: "preload" | "upload" | null;
  /** Signals built from workspace data — passed down to HealthView hero strip. */
  workspaceSignals: WorkspaceSignal[];
  overviewFilters: OverviewFilterState;
  onOverviewFiltersChange: Dispatch<SetStateAction<OverviewFilterState>>;
  timelineFilters: TimelineFilterState;
  onTimelineFiltersChange: Dispatch<SetStateAction<TimelineFilterState>>;
  assetViewState: AssetViewState;
  onAssetViewStateChange: Dispatch<SetStateAction<AssetViewState>>;
  runsViewState: RunsViewState;
  onRunsViewStateChange: Dispatch<SetStateAction<RunsViewState>>;
  lineageViewState: LineageViewState;
  onLineageViewStateChange: Dispatch<SetStateAction<LineageViewState>>;
  investigationSelection: InvestigationSelectionState;
  onInvestigationSelectionChange: Dispatch<
    SetStateAction<InvestigationSelectionState>
  >;
  onNavigateTo: (
    view: WorkspaceView,
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: AssetTab;
      rootResourceId?: string;
    },
  ) => void;
}
