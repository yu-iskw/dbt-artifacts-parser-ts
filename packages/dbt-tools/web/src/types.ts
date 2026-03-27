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
  ResourceNode,
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
