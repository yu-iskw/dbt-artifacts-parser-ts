import type { Dispatch, SetStateAction } from "react";
import type { AnalysisState, StatusTone } from "@web/types";

export type WorkspaceView = "overview" | "catalog" | "runs";

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
}

export interface RunsViewState {
  tab: RunsTab;
  kind: RunsKind;
}

export interface AnalysisWorkspaceProps {
  analysis: AnalysisState;
  activeView: WorkspaceView;
  activeViewTitle: string;
  analysisSource: "preload" | "upload" | null;
  overviewFilters: OverviewFilterState;
  onOverviewFiltersChange: Dispatch<SetStateAction<OverviewFilterState>>;
  resultsFilters: ResultsFilterState;
  onResultsFiltersChange: Dispatch<SetStateAction<ResultsFilterState>>;
  timelineFilters: TimelineFilterState;
  onTimelineFiltersChange: Dispatch<SetStateAction<TimelineFilterState>>;
  assetViewState: AssetViewState;
  onAssetViewStateChange: Dispatch<SetStateAction<AssetViewState>>;
  runsViewState: RunsViewState;
}
