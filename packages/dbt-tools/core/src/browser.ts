/**
 * Browser-safe entry point for @dbt-tools/core.
 * Re-exports only APIs that do not depend on Node.js (fs, path).
 */
export { ManifestGraph } from "./analysis/manifest-graph";
export {
  ExecutionAnalyzer,
  buildNodeExecutionsFromRunResults,
} from "./analysis/execution-analyzer";
export { GraphBottleneckAnalyzer } from "./analysis/graph-bottleneck-analyzer";
export {
  searchRunResults,
  detectBottlenecks,
  detectAdapterHeavyNodes,
} from "./analysis/run-results-search";
export {
  buildAdapterTotals,
  normalizeAdapterResponse,
  adapterMetricsHasData,
} from "./analysis/adapter-response-metrics";
export {
  buildAnalysisSnapshotFromArtifacts,
  buildAnalysisSnapshotFromParsedArtifacts,
} from "./analysis/analysis-snapshot";
export type {
  NodeExecution,
  ExecutionSummary,
  CriticalPath,
} from "./analysis/execution-analyzer";
export type {
  BottleneckNodeScore,
  BottleneckReport,
  BottleneckOptions,
} from "./analysis/graph-bottleneck-analyzer";
export type {
  BottleneckNode,
  BottleneckResult,
  RunResultsSearchCriteria,
  AdapterHeavyMetric,
  AdapterHeavyNode,
  AdapterHeavyResult,
} from "./analysis/run-results-search";
export type {
  AdapterResponseField,
  AdapterResponseFieldKind,
  AdapterResponseMetrics,
  AdapterTotalsSnapshot,
} from "./analysis/adapter-response-metrics";
export type {
  AnalysisSnapshot,
  AnalysisSnapshotBuildTimings,
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
} from "./analysis/analysis-snapshot";
