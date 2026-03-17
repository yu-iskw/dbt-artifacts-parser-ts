import type {
  ExecutionSummary,
  BottleneckResult,
} from "@dbt-tools/core/browser";

export interface GanttItem {
  unique_id: string;
  name: string;
  start: number;
  end: number;
  duration: number;
  status: string;
  /** dbt resource type (model, test, seed, snapshot, etc.). Inferred from unique_id prefix when absent from the manifest graph. */
  resourceType: string;
}

export type StatusTone = "positive" | "warning" | "danger" | "neutral";

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
  description: string | null;
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

export interface ResourceConnectionSummary {
  upstreamCount: number;
  downstreamCount: number;
  upstream: DependencyPreview[];
  downstream: DependencyPreview[];
}

export interface AnalysisState {
  summary: ExecutionSummary;
  /** Project name from manifest metadata, or null for older manifests. */
  projectName: string | null;
  /** Absolute epoch-ms of the earliest executed node. Null when no timing data. */
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
  selectedResourceId: string | null;
}
