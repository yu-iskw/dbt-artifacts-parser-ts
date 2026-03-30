import type {
  AnalysisSnapshot,
  MetricDefinition,
  ResourceDefinition,
  SemanticModelDefinition,
  StatusTone,
} from "./analysis-snapshot-types";

export const RESOURCE_TYPE_ORDER = [
  "model",
  "source",
  "test",
  "metric",
  "semantic_model",
  "exposure",
  "seed",
  "snapshot",
  "unit_test",
  "analysis",
  "macro",
] as const;

export function now(): number {
  return performance.now();
}

export function statusTone(status: string | null | undefined): StatusTone {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) return "neutral";
  if (["success", "pass", "passed"].includes(normalized)) {
    return "positive";
  }
  if (["warn", "warning"].includes(normalized)) {
    return "warning";
  }
  if (["error", "fail", "failed", "run error"].includes(normalized)) {
    return "danger";
  }
  return "neutral";
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "Unknown";
  return status
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function inferPackageNameFromUniqueId(uniqueId: string): string {
  const parts = uniqueId.split(".");
  if (parts.length < 2) return "";
  return parts[1] ?? "";
}

export function inferResourceTypeFromId(uniqueId: string): string {
  const prefix = uniqueId.split(".")[0] ?? "";
  const known = new Set([
    "model",
    "test",
    "unit_test",
    "seed",
    "snapshot",
    "source",
    "source_freshness",
    "exposure",
    "metric",
    "semantic_model",
    "analysis",
    "macro",
  ]);
  return known.has(prefix) ? prefix : "operation";
}

export function resourceTypeLabel(resourceType: string): string {
  return resourceType
    .split("_")
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function buildMetricDefinition(
  attributes: Record<string, unknown>,
): MetricDefinition {
  const primaryMeasure =
    typeof attributes.metric_measure === "string"
      ? attributes.metric_measure
      : null;
  const measures = normalizeStringArray(attributes.metric_input_measures);

  return {
    kind: "metric",
    label: typeof attributes.label === "string" ? attributes.label : null,
    description:
      typeof attributes.description === "string"
        ? attributes.description
        : null,
    metricType:
      typeof attributes.metric_type === "string"
        ? attributes.metric_type
        : null,
    expression:
      typeof attributes.metric_expression === "string"
        ? attributes.metric_expression
        : null,
    sourceReference:
      typeof attributes.metric_source_reference === "string"
        ? attributes.metric_source_reference
        : typeof attributes.metric_measure === "string"
          ? attributes.metric_measure
          : null,
    filters: normalizeStringArray(attributes.metric_filters),
    timeGranularity:
      typeof attributes.metric_time_granularity === "string"
        ? attributes.metric_time_granularity
        : null,
    measures:
      measures.length > 0
        ? measures
        : primaryMeasure != null
          ? [primaryMeasure]
          : [],
    metrics: normalizeStringArray(attributes.metric_input_metrics),
  };
}

function buildSemanticModelDefinition(
  attributes: Record<string, unknown>,
): SemanticModelDefinition {
  return {
    kind: "semantic_model",
    label: typeof attributes.label === "string" ? attributes.label : null,
    description:
      typeof attributes.description === "string"
        ? attributes.description
        : null,
    sourceReference:
      typeof attributes.semantic_model_reference === "string"
        ? attributes.semantic_model_reference
        : null,
    defaultTimeDimension:
      typeof attributes.semantic_model_default_time_dimension === "string"
        ? attributes.semantic_model_default_time_dimension
        : null,
    entities: normalizeStringArray(attributes.semantic_model_entities),
    measures: normalizeStringArray(attributes.semantic_model_measures),
    dimensions: normalizeStringArray(attributes.semantic_model_dimensions),
  };
}

export function buildResourceDefinition(
  resourceType: string,
  attributes: Record<string, unknown>,
): ResourceDefinition | null {
  if (resourceType === "metric") {
    return buildMetricDefinition(attributes);
  }
  if (resourceType === "semantic_model") {
    return buildSemanticModelDefinition(attributes);
  }
  return null;
}

export function sortByResourceType(a: string, b: string): number {
  const aIndex = RESOURCE_TYPE_ORDER.indexOf(
    a as (typeof RESOURCE_TYPE_ORDER)[number],
  );
  const bIndex = RESOURCE_TYPE_ORDER.indexOf(
    b as (typeof RESOURCE_TYPE_ORDER)[number],
  );
  if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
}

export function sortResources(
  a: { resourceType: string; name: string },
  b: { resourceType: string; name: string },
): number {
  const typeOrder = sortByResourceType(a.resourceType, b.resourceType);
  if (typeOrder !== 0) return typeOrder;
  return a.name.localeCompare(b.name);
}

export function buildProjectName(
  manifestJson: Record<string, unknown>,
): string | null {
  const metaMaybe = manifestJson.metadata;
  if (
    metaMaybe !== null &&
    typeof metaMaybe === "object" &&
    "project_name" in (metaMaybe as object) &&
    typeof (metaMaybe as Record<string, unknown>).project_name === "string" &&
    (metaMaybe as Record<string, string>).project_name !== ""
  ) {
    return (metaMaybe as Record<string, string>).project_name;
  }
  return null;
}

export function buildInvocationId(
  runResultsJson: Record<string, unknown>,
): string | null {
  const metadata =
    runResultsJson.metadata != null &&
    typeof runResultsJson.metadata === "object"
      ? (runResultsJson.metadata as Record<string, unknown>)
      : null;
  return typeof metadata?.invocation_id === "string"
    ? metadata.invocation_id
    : null;
}

export function buildWarehouseType(
  manifestJson: Record<string, unknown>,
): string | null {
  const metaMaybe = manifestJson.metadata;
  if (
    metaMaybe !== null &&
    typeof metaMaybe === "object" &&
    "adapter_type" in (metaMaybe as object) &&
    typeof (metaMaybe as Record<string, unknown>).adapter_type === "string" &&
    (metaMaybe as Record<string, string>).adapter_type !== ""
  ) {
    return (metaMaybe as Record<string, string>).adapter_type;
  }
  return null;
}

export function buildResourceGroups(resources: AnalysisSnapshot["resources"]) {
  const groupedResources = new Map<string, AnalysisSnapshot["resources"]>();
  for (const resource of resources) {
    const current = groupedResources.get(resource.resourceType) ?? [];
    current.push(resource);
    groupedResources.set(resource.resourceType, current);
  }
  return [...groupedResources.entries()]
    .sort(([a], [b]) => sortByResourceType(a, b))
    .map(([resourceType, grouped]) => ({
      resourceType,
      label: resourceTypeLabel(resourceType),
      count: grouped.length,
      attentionCount: grouped.filter(
        (r) => r.statusTone === "danger" || r.statusTone === "warning",
      ).length,
      resources: grouped,
    }));
}
