import type {
  AnalysisState,
  ExecutionRow,
  GanttItem,
  ResourceNode,
  StatusTone,
} from "@web/types";
import type { DashboardStatusFilter } from "./types";
import {
  rollupCountsHaveAttention,
  type ResourceTestRollupCounts,
} from "./testRollupTypes";
import { TEST_RESOURCE_TYPES, PRIMARY_TIMELINE_TYPES } from "./constants";

export function isFailedModelExecution(row: ExecutionRow): boolean {
  return (
    row.statusTone === "danger" &&
    !TEST_RESOURCE_TYPES.has(row.resourceType) &&
    row.resourceType !== "operation" &&
    row.resourceType !== "sql_operation"
  );
}

export function formatSeconds(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  if (value >= 60) {
    const minutes = Math.floor(value / 60);
    const secs = value % 60;
    return `${minutes}m ${secs.toFixed(2).padStart(5, "0")}s`;
  }
  if (value >= 10) return `${value.toFixed(1)}s`;
  return `${value.toFixed(2)}s`;
}

export function formatResourceTypeLabel(resourceType: string): string {
  return resourceType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRunStartedAt(epochMs: number): string {
  return new Date(epochMs).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function getInvocationTimestamp(analysis: AnalysisState): number | null {
  return analysis.runStartedAt;
}

export function badgeClassName(tone: StatusTone): string {
  return `tone-badge tone-badge--${tone}`;
}

export function displayResourcePath(resource: ResourceNode): string | null {
  return normalizeManifestFilePath(
    resource.originalFilePath ?? resource.patchPath ?? resource.path,
  );
}

export function normalizeManifestFilePath(path: string | null): string | null {
  if (!path) return null;
  const normalized = path.includes("://")
    ? (path.split("://")[1] ?? null)
    : path;
  if (!normalized) return null;
  const sanitized = normalized
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
  return sanitized.length > 0 ? sanitized : null;
}

export function matchesResource(
  resource: ResourceNode,
  query: string,
): boolean {
  if (!query) return true;
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    resource.name,
    resource.resourceType,
    resource.packageName,
    resource.path ?? "",
    resource.originalFilePath ?? "",
    resource.patchPath ?? "",
    resource.uniqueId,
  ].some((value) => value.toLowerCase().includes(normalized));
}

export function matchesAssetStatus(
  resource: ResourceNode,
  status: DashboardStatusFilter,
  resourceTestRollupById?: ReadonlyMap<string, ResourceTestRollupCounts>,
): boolean {
  if (status === "all") return true;
  if (status === "issues") {
    if (resource.statusTone === "danger") return true;
    return rollupCountsHaveAttention(
      resourceTestRollupById?.get(resource.uniqueId),
    );
  }
  return resource.statusTone === status;
}

export function matchesAssetResourceType(
  resource: ResourceNode,
  activeTypes: Set<string>,
): boolean {
  return activeTypes.size === 0 || activeTypes.has(resource.resourceType);
}

export function matchesExecution(row: ExecutionRow, query: string): boolean {
  if (!query) return true;
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    row.name,
    row.resourceType,
    row.packageName,
    row.path ?? "",
    row.uniqueId,
    row.status,
    row.threadId ?? "",
  ].some((value) => value.toLowerCase().includes(normalized));
}

/** Runs / health execution lists: `issues` means danger or warning on the row (not explorer test rollup). */
export function matchesExecutionRowDashboardStatus(
  row: ExecutionRow,
  status: DashboardStatusFilter,
): boolean {
  if (status === "all") return true;
  if (status === "issues") {
    return row.statusTone === "danger" || row.statusTone === "warning";
  }
  return row.statusTone === status;
}

/**
 * Derive the "home project" name from the most common packageName in
 * executions. Executed nodes are almost always from the user's project.
 */
export function deriveProjectName(executions: ExecutionRow[]): string | null {
  if (executions.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const row of executions) {
    if (row.packageName) {
      counts[row.packageName] = (counts[row.packageName] ?? 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

export function isMainProjectResource(
  resource: Pick<ResourceNode, "packageName">,
  projectName: string | null,
): boolean {
  return projectName != null && resource.packageName === projectName;
}

export function isInternalArtifactResource({
  name,
  packageName,
  path,
}: Pick<GanttItem, "name" | "packageName" | "path">): boolean {
  const normalizedName = name.toLowerCase();
  const normalizedPackage = packageName.toLowerCase();
  const normalizedPath = (path ?? "").toLowerCase();
  const internalNames = new Set([
    "dbt_artifacts_hashes",
    "dbt_columns",
    "dbt_exposures",
    "dbt_groups",
    "dbt_invocations",
    "dbt_metrics",
    "dbt_models",
    "dbt_run_results",
    "dbt_seeds",
    "dbt_snapshots",
    "dbt_source_freshness_results",
    "dbt_sources",
    "dbt_tests",
    "elementary_test_results",
    "job_run_results",
    "locations",
    "metadata",
    "metricflow_time_spine",
    "model_run_results",
    "schema_columns_snapshot",
    "seed_run_results",
    "snapshot_run_results",
    "test_result_rows",
  ]);
  return (
    internalNames.has(normalizedName) ||
    normalizedName.startsWith("dbt_") ||
    normalizedName.startsWith("alerts_dbt_") ||
    normalizedPath.includes("/edr/") ||
    normalizedPath.includes("/dbt_artifacts/") ||
    normalizedPath.includes("/run_results/") ||
    normalizedPath.includes("/manifest/") ||
    normalizedPath.includes("/catalog/") ||
    (normalizedPackage === "elementary" &&
      (normalizedName.includes("dbt_") ||
        normalizedPath.includes("/edr/dbt_artifacts/")))
  );
}

export function getDefaultTimelineActiveTypes(
  presentTypes: string[],
): Set<string> {
  return new Set(
    presentTypes.filter(
      (type) => type !== "macro" && type !== "test" && type !== "unit_test",
    ),
  );
}

export function isDefaultTimelineResource(
  item: Pick<GanttItem, "resourceType" | "packageName" | "name" | "path">,
  projectName?: string | null,
): boolean {
  if (
    !PRIMARY_TIMELINE_TYPES.has(item.resourceType) ||
    TEST_RESOURCE_TYPES.has(item.resourceType) ||
    isInternalArtifactResource(item)
  ) {
    return false;
  }
  if (projectName == null) return true;
  return item.packageName === projectName;
}
