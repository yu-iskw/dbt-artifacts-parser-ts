const DBT_V2_FRESHNESS_STATUS_MAP: Record<string, string> = {
  Pass: "pass",
  Warn: "warn",
  Error: "error",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Normalize known dbt v2/Fusion sources/v3 wire differences.
 *
 * dbt v2 can serialize FreshnessStatus using Rust enum variant names while the
 * published sources/v3 schema uses lowercase values. Only the exact status
 * field is normalized, and the caller's object is left unchanged.
 */
export function normalizeSourcesV3(
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  const results = parsed.results;
  if (!Array.isArray(results)) {
    return parsed;
  }

  let normalizedResults: unknown[] | undefined;

  for (const [index, result] of results.entries()) {
    if (!isRecord(result) || typeof result.status !== "string") {
      continue;
    }

    const canonicalStatus = DBT_V2_FRESHNESS_STATUS_MAP[result.status];
    if (!canonicalStatus) {
      continue;
    }

    normalizedResults ??= [...results];
    normalizedResults[index] = {
      ...result,
      status: canonicalStatus,
    };
  }

  return normalizedResults ? { ...parsed, results: normalizedResults } : parsed;
}
