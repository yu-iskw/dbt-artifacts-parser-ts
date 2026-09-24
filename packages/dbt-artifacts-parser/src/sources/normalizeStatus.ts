/**
 * dbt v2 sources.json may emit Pass/Warn/Error (same casing as freshness v0).
 * Published sources v3 expects pass/warn/error.
 */
const SOURCES_STATUS_ALIASES: Record<string, string> = {
  Pass: "pass",
  Warn: "warn",
  Error: "error",
};

/**
 * Normalize capitalized freshness statuses for sources v3.
 * Returns the input unchanged when no results need remapping.
 */
export function normalizeSourcesResultStatus(
  artifact: Record<string, unknown>,
): Record<string, unknown> {
  const results = artifact.results;
  if (!Array.isArray(results)) {
    return artifact;
  }

  let changed = false;
  const newResults = results.map((item) => {
    if (
      item !== null &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      "status" in item
    ) {
      const record = item as Record<string, unknown>;
      const status = record.status;
      if (typeof status === "string" && status in SOURCES_STATUS_ALIASES) {
        changed = true;
        return { ...record, status: SOURCES_STATUS_ALIASES[status] };
      }
    }
    return item;
  });

  if (!changed) {
    return artifact;
  }

  return { ...artifact, results: newResults };
}
