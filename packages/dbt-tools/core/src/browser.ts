/**
 * Browser-safe entry point for @dbt-tools/core.
 * Re-exports only APIs that do not depend on Node.js (fs, path).
 */
export { ManifestGraph } from "./analysis/manifest-graph";
export { ExecutionAnalyzer } from "./analysis/execution-analyzer";
export {
  searchRunResults,
  detectBottlenecks,
} from "./analysis/run-results-search";
export type {
  NodeExecution,
  ExecutionSummary,
  CriticalPath,
} from "./analysis/execution-analyzer";
export type {
  BottleneckNode,
  BottleneckResult,
  RunResultsSearchCriteria,
} from "./analysis/run-results-search";
