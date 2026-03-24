import type { StatusTone } from "@web/types";
import type { WorkspaceView, AssetExplorerMode } from "./types";

export const STATUS_COLORS: Record<StatusTone, string> = {
  positive: "#2bb673",
  warning: "#f2a44b",
  danger: "#d86066",
  neutral: "#8e97a6",
};

export const PILL_ACTIVE = "workspace-pill workspace-pill--active";
export const PILL_BASE = "workspace-pill";

export const PRIMARY_PROJECT_SUMMARY_GROUPS = [
  { key: "model", label: "Models" },
  { key: "tests", label: "Tests" },
  { key: "snapshot", label: "Snapshots" },
  { key: "metric", label: "Metrics" },
  { key: "semantic_model", label: "Semantic models" },
] as const;

export const PRIMARY_TIMELINE_TYPES = new Set([
  "model",
  "seed",
  "snapshot",
  "source",
  "test",
  "unit_test",
  "metric",
  "semantic_model",
]);

// Resource types classified as "test" in the Results split
export const TEST_RESOURCE_TYPES = new Set(["test", "unit_test"]);

export const VIEW_TITLES: Record<WorkspaceView, string> = {
  overview: "Run overview",
  catalog: "Catalog workspace",
  runs: "Run analysis",
};

export const EXPLORER_MODE_LABELS: Record<AssetExplorerMode, string> = {
  project: "Project",
  database: "Database",
};
