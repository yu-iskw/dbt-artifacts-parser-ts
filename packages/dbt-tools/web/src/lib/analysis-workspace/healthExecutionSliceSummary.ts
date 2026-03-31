import type { OverviewFilterState } from "./types";

/**
 * Short label for the Health "Refine slice" control (types + search; not dashboard status).
 */
export function buildHealthExecutionSliceSummary(
  filters: OverviewFilterState,
): string {
  const q = filters.query.trim();
  const n = filters.resourceTypes.size;
  const typePart = n === 0 ? "All types" : `${n} type${n === 1 ? "" : "s"}`;
  if (!q) {
    return `${typePart} · no search`;
  }
  const max = 28;
  const shown = q.length > max ? `${q.slice(0, max)}…` : q;
  return `${typePart} · "${shown}"`;
}
