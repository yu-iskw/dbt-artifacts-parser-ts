import type { ResourceNode as CoreResourceNode } from "@dbt-tools/core/browser";

export type {
  AnalysisSnapshot as AnalysisState,
  DependencyPreview,
  ExecutionRow,
  GanttItem,
  GraphSnapshot,
  MetricDefinition,
  ResourceConnectionSummary,
  ResourceDefinition,
  ResourceGroup,
  SemanticModelDefinition,
  StatusBreakdownItem,
  StatusTone,
  ThreadStat,
  TimelineAdjacencyEntry,
} from "@dbt-tools/core/browser";

export interface ResourceTestStats {
  pass: number;
  fail: number;
  error: number;
}

export interface CatalogColumn {
  name: string;
  type: string;
  index: number;
  comment: string | null;
}

/** ResourceNode extended with optional catalog column metadata. */
export interface ResourceNode extends CoreResourceNode {
  columns?: CatalogColumn[];
}
