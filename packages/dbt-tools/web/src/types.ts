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
}

export interface AnalysisState {
  summary: ExecutionSummary;
  ganttData: GanttItem[];
  bottlenecks: BottleneckResult | undefined;
}
