import type { BottleneckResult } from "./run-results-search";
import type { ExecutionSummary } from "./execution-analyzer";

export interface GanttItem {
  unique_id: string;
  name: string;
  start: number;
  end: number;
  duration: number;
  status: string;
  resourceType: string;
  packageName: string;
  path: string | null;
  parentId: string | null;
  compileStart?: number | null;
  compileEnd?: number | null;
  executeStart?: number | null;
  executeEnd?: number | null;
  materialized?: string | null;
}

export type StatusTone = "positive" | "warning" | "danger" | "neutral";

export interface MetricDefinition {
  kind: "metric";
  label: string | null;
  description: string | null;
  metricType: string | null;
  expression: string | null;
  sourceReference: string | null;
  filters: string[];
  timeGranularity: string | null;
  measures: string[];
  metrics: string[];
}

export interface SemanticModelDefinition {
  kind: "semantic_model";
  label: string | null;
  description: string | null;
  sourceReference: string | null;
  defaultTimeDimension: string | null;
  entities: string[];
  measures: string[];
  dimensions: string[];
}

export type ResourceDefinition = MetricDefinition | SemanticModelDefinition;

export interface GraphSnapshot {
  totalNodes: number;
  totalEdges: number;
  hasCycles: boolean;
  nodesByType: Record<string, number>;
}

export interface ResourceNode {
  uniqueId: string;
  name: string;
  resourceType: string;
  packageName: string;
  path: string | null;
  originalFilePath: string | null;
  patchPath?: string | null;
  database?: string | null;
  schema?: string | null;
  description: string | null;
  compiledCode?: string | null;
  rawCode?: string | null;
  definition?: ResourceDefinition | null;
  status: string | null;
  statusTone: StatusTone;
  executionTime: number | null;
  threadId: string | null;
}

export interface ResourceGroup {
  resourceType: string;
  label: string;
  count: number;
  attentionCount: number;
  resources: ResourceNode[];
}

export interface ExecutionRow {
  uniqueId: string;
  name: string;
  resourceType: string;
  packageName: string;
  path: string | null;
  status: string;
  statusTone: StatusTone;
  executionTime: number;
  threadId: string | null;
  start: number | null;
  end: number | null;
}

export interface StatusBreakdownItem {
  status: string;
  count: number;
  duration: number;
  share: number;
  tone: StatusTone;
}

export interface ThreadStat {
  threadId: string;
  count: number;
  totalExecutionTime: number;
}

export interface DependencyPreview {
  uniqueId: string;
  name: string;
  resourceType: string;
  depth: number;
}

/**
 * Direct (1-hop) dependency edges only. `upstream` / `downstream` preview at
 * most 8 neighbors; counts are total direct neighbors, not transitive closure.
 */
export interface ResourceConnectionSummary {
  upstreamCount: number;
  downstreamCount: number;
  upstream: DependencyPreview[];
  downstream: DependencyPreview[];
}

export interface TimelineAdjacencyEntry {
  inbound: string[];
  outbound: string[];
}

export interface AnalysisSnapshot {
  summary: ExecutionSummary;
  projectName: string | null;
  warehouseType?: string | null;
  runStartedAt: number | null;
  ganttData: GanttItem[];
  bottlenecks: BottleneckResult | undefined;
  graphSummary: GraphSnapshot;
  resources: ResourceNode[];
  resourceGroups: ResourceGroup[];
  executions: ExecutionRow[];
  statusBreakdown: StatusBreakdownItem[];
  threadStats: ThreadStat[];
  dependencyIndex: Record<string, ResourceConnectionSummary>;
  timelineAdjacency: Record<string, TimelineAdjacencyEntry>;
  selectedResourceId: string | null;
  invocationId?: string | null;
}

export interface AnalysisSnapshotBuildTimings {
  graphBuildMs: number;
  snapshotBuildMs: number;
}
