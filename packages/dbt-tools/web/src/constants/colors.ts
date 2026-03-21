/** Execution status → bar fill color. */
export const STATUS_COLORS: Record<string, string> = {
  success: "#2bb673",
  error: "#d86066",
  skipped: "#94a3b8",
  "run error": "#d86066",
  pass: "#2bb673",
  fail: "#d86066",
  warn: "#f2a44b",
  "no op": "#94a3b8",
};

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status.toLowerCase()] ?? "#64748b";
}

/** dbt resource type → left-border accent color. */
export const RESOURCE_TYPE_COLORS: Record<string, string> = {
  model: "#2558d9",
  test: "#8b5cf6",
  seed: "#0ea5e9",
  snapshot: "#14b8a6",
  source: "#94a3b8",
  exposure: "#f97316",
  metric: "#ec4899",
  semantic_model: "#6366f1",
  analysis: "#78716c",
  unit_test: "#a78bfa",
};

export function getResourceTypeColor(resourceType: string | undefined): string {
  return (resourceType && RESOURCE_TYPE_COLORS[resourceType]) ?? "#cbd5e1";
}
