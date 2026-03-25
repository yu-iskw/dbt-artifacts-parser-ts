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
  | "execution"
  | "quality"
  | "dependencies"
  | "search"
  // legacy — redirect targets below
  | "overview"
  | "catalog"
  | "runs";

/** Sub-tabs within the Execution lens. */
export type ExecutionTab = "results" | "timeline";

/** @deprecated Use ExecutionTab instead */
export type RunsTab = "results" | "timeline";
export type RunsKind = "models" | "tests";

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
}

export interface AssetViewState {
  explorerMode: AssetExplorerMode;
  status: DashboardStatusFilter;
  resourceTypes: Set<string>;
  resourceQuery: string;
  selectedResourceId: string | null;
  // Lineage depth settings — persisted in URL for link sharing.
  upstreamDepth: number;
  downstreamDepth: number;
  allDepsMode: boolean;
  lensMode: LensMode;
  activeLegendKeys: Set<string>;
}

export interface RunsViewState {
  tab: RunsTab;
  kind: RunsKind;
}

/** State for the Execution lens (merges Models + Timeline). */
export interface ExecutionViewState {
  tab: ExecutionTab;
}

/** State for the Quality lens (test triage). */
export interface QualityFilterState {
  status: DashboardStatusFilter;
  query: string;
}

/** State for the Dependencies lens (first-class lineage). */
export interface DependenciesViewState {
  selectedResourceId: string | null;
  upstreamDepth: number;
  downstreamDepth: number;
  allDepsMode: boolean;
  lensMode: LensMode;
  activeLegendKeys: Set<string>;
}

/** State for the Search lens. */
export interface SearchViewState {
  query: string;
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
  activeViewTitle: string;
  analysisSource: "preload" | "upload" | null;
  /** Signals built from workspace data — passed down to HealthView hero strip. */
  workspaceSignals: WorkspaceSignal[];
  overviewFilters: OverviewFilterState;
  onOverviewFiltersChange: Dispatch<SetStateAction<OverviewFilterState>>;
  resultsFilters: ResultsFilterState;
  onResultsFiltersChange: Dispatch<SetStateAction<ResultsFilterState>>;
  timelineFilters: TimelineFilterState;
  onTimelineFiltersChange: Dispatch<SetStateAction<TimelineFilterState>>;
  assetViewState: AssetViewState;
  onAssetViewStateChange: Dispatch<SetStateAction<AssetViewState>>;
  runsViewState: RunsViewState;
  executionViewState: ExecutionViewState;
  onExecutionViewStateChange: Dispatch<SetStateAction<ExecutionViewState>>;
  qualityFilters: QualityFilterState;
  onQualityFiltersChange: Dispatch<SetStateAction<QualityFilterState>>;
  dependenciesViewState: DependenciesViewState;
  onDependenciesViewStateChange: Dispatch<SetStateAction<DependenciesViewState>>;
  searchViewState: SearchViewState;
  onSearchViewStateChange: Dispatch<SetStateAction<SearchViewState>>;
  onNavigateTo: (view: WorkspaceView, resourceId?: string) => void;
}
