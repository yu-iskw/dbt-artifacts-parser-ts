/**
 * Shared limit/offset parsing for list-style CLI commands (inventory, search, failures).
 * Aligns max limit with discover ranking (`packages/dbt-tools/core/src/discovery/rank.ts`).
 */
export const CLI_LIST_MAX_LIMIT = 200;

export function parseOptionalListLimit(
  limit: number | undefined,
): number | undefined {
  if (limit === undefined) {
    return undefined;
  }
  if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit < 1) {
    throw new Error("--limit must be a positive integer");
  }
  if (limit > CLI_LIST_MAX_LIMIT) {
    throw new Error(`--limit cannot exceed ${CLI_LIST_MAX_LIMIT}`);
  }
  return limit;
}

export function parseListOffset(offset: number | undefined): number {
  if (offset === undefined || offset === 0) {
    return 0;
  }
  if (!Number.isFinite(offset) || !Number.isInteger(offset) || offset < 0) {
    throw new Error("--offset must be a non-negative integer");
  }
  return offset;
}

export function assertOffsetRequiresLimit(
  limit: number | undefined,
  offset: number,
): void {
  if (offset > 0 && limit === undefined) {
    throw new Error("--offset requires --limit");
  }
}

/** Default page size for `failures` when --limit is omitted (agent-safe). */
export const FAILURES_DEFAULT_LIMIT = 50;

export function resolveFailuresLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return FAILURES_DEFAULT_LIMIT;
  }
  return parseOptionalListLimit(limit)!;
}
