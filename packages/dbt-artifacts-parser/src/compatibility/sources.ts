/**
 * Fusion still writes `sources.json` labeled as schema v3, but serializes
 * freshness status with the PascalCase `FreshnessStatus` enum used by
 * `freshness.json` v0 (`Pass` / `Warn` / `Error`).
 *
 * Published sources v3 remains lowercase: `pass` | `warn` | `error` |
 * `runtime error`. This shim is a producer-compat mapping only. Do not apply
 * it to `freshness.json`.
 *
 * Removal condition: Fusion emits lowercase sources v3 statuses (or bumps the
 * sources schema version).
 */

export type FusionSourcesStatusAlias = "Pass" | "Warn" | "Error";
export type CanonicalSourcesV3Status = "pass" | "warn" | "error";

export function isFusionSourcesStatusAlias(
  status: unknown,
): status is FusionSourcesStatusAlias {
  return status === "Pass" || status === "Warn" || status === "Error";
}

export function canonicalSourcesV3Status(
  status: FusionSourcesStatusAlias,
): CanonicalSourcesV3Status {
  switch (status) {
    case "Pass":
      return "pass";
    case "Warn":
      return "warn";
    case "Error":
      return "error";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function normalizeResultRow(row: unknown): { row: unknown; changed: boolean } {
  if (row === null || typeof row !== "object") {
    return { row, changed: false };
  }
  const record = row as Record<string, unknown>;
  if (!isFusionSourcesStatusAlias(record.status)) {
    return { row, changed: false };
  }
  return {
    row: { ...record, status: canonicalSourcesV3Status(record.status) },
    changed: true,
  };
}

/**
 * Map Fusion PascalCase `sources.json` v3 statuses onto the published schema
 * enum. Leaves Core lowercase values and unknown strings untouched. Does not
 * recurse into nested objects.
 */
export function normalizeSourcesV3ProducerStatus(
  artifact: Record<string, unknown>,
): Record<string, unknown> {
  const results = artifact.results;
  if (!Array.isArray(results)) {
    return artifact;
  }

  let changed = false;
  const nextResults = results.map((row) => {
    const normalized = normalizeResultRow(row);
    if (normalized.changed) {
      changed = true;
    }
    return normalized.row;
  });

  if (!changed) {
    return artifact;
  }
  return { ...artifact, results: nextResults };
}
