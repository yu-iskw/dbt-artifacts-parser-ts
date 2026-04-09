import type { ParsedSources } from "dbt-artifacts-parser/sources";
import type { ParsedManifest } from "dbt-artifacts-parser/manifest";

/**
 * Normalized source freshness entry
 */
export interface SourceFreshnessEntry {
  unique_id: string;
  name?: string;
  source_name?: string;
  package_name?: string;
  status: string;
  max_loaded_at?: string;
  snapshotted_at?: string;
  age_seconds?: number;
  warn_after?: { count?: number; period?: string } | null;
  error_after?: { count?: number; period?: string } | null;
  filter?: string | null;
  execution_time?: number;
  message?: string;
  // Manifest-enriched fields
  resource_type?: string;
  path?: string;
  original_file_path?: string;
  tags?: string[];
  description?: string;
}

/**
 * Source freshness summary statistics
 */
export interface SourceFreshnessSummary {
  total: number;
  counts_by_status: Record<string, number>;
  entries: SourceFreshnessEntry[];
}

/**
 * Stale impact report
 */
export interface StaleImpactReport {
  source: {
    unique_id: string;
    name?: string;
    source_name?: string;
    status?: string;
  };
  direct_downstream_count: number;
  total_downstream_count: number;
  impacted_counts_by_type: Record<string, number>;
  impacted_nodes: Array<{
    unique_id: string;
    depth: number;
    resource_type?: string;
    name?: string;
  }>;
}

/**
 * SourceFreshnessAnalyzer processes sources.json to extract freshness information
 * and correlate it with the dependency graph.
 */
export class SourceFreshnessAnalyzer {
  constructor(private sources: ParsedSources) {}

  /**
   * Summarize freshness results
   */
  summarize(): SourceFreshnessSummary {
    const entries = this.normalizeEntries();
    const counts_by_status: Record<string, number> = {};

    for (const entry of entries) {
      const status = entry.status || "unknown";
      counts_by_status[status] = (counts_by_status[status] || 0) + 1;
    }

    return {
      total: entries.length,
      counts_by_status,
      entries,
    };
  }

  /**
   * Filter entries by status
   */
  filterByStatus(statuses: string[]): SourceFreshnessSummary {
    const summary = this.summarize();
    const filtered = summary.entries.filter((entry) =>
      statuses.includes(entry.status),
    );

    const counts_by_status: Record<string, number> = {};
    for (const entry of filtered) {
      const status = entry.status || "unknown";
      counts_by_status[status] = (counts_by_status[status] || 0) + 1;
    }

    return {
      total: filtered.length,
      counts_by_status,
      entries: filtered,
    };
  }

  /**
   * Enrich sources with manifest data
   */
  enrichWithManifest(manifest: ParsedManifest): SourceFreshnessSummary {
    const summary = this.summarize();
    const sources = (manifest.sources as Record<string, unknown>) || {};

    for (const entry of summary.entries) {
      const manifestEntry = (sources[entry.unique_id] as unknown) as Record<
        string,
        unknown
      > | null;
      if (manifestEntry) {
        entry.resource_type = "source";
        entry.path = (manifestEntry.path as string) || undefined;
        entry.original_file_path =
          (manifestEntry.original_file_path as string) || undefined;
        entry.tags = ((manifestEntry.tags as string[]) || []).slice();
        entry.description = (manifestEntry.description as string) || undefined;
      }
    }

    return summary;
  }

  /**
   * Normalize sources results to typed entries
   */
  private normalizeEntries(): SourceFreshnessEntry[] {
    if (!this.sources.results || !Array.isArray(this.sources.results)) {
      return [];
    }

    return this.sources.results.map((result) => {
      const resultAny = result as unknown as Record<string, unknown>;
      const unique_id = resultAny.unique_id as string;

      // Extract parts of unique_id (source.package.source_name.table_name)
      const parts = unique_id.split(".");
      const source_name = parts[2];
      const name = parts[3];
      const package_name = parts[1];

      // Base entry structure
      const entry: SourceFreshnessEntry = {
        unique_id,
        name,
        source_name,
        package_name,
        status: (resultAny.status as string) || "unknown",
      };

      // Runtime error case
      if (resultAny.status === "runtime error") {
        entry.message = (resultAny.error as string) || undefined;
        return entry;
      }

      // Normal freshness output
      entry.max_loaded_at = resultAny.max_loaded_at as string;
      entry.snapshotted_at = resultAny.snapshotted_at as string;
      entry.age_seconds = resultAny.max_loaded_at_time_ago_in_s as number;
      entry.execution_time = resultAny.execution_time as number;

      // Criteria
      const criteria = resultAny.criteria as Record<string, unknown>;
      if (criteria) {
        entry.warn_after = criteria.warn_after as
          | { count?: number; period?: string }
          | null;
        entry.error_after = criteria.error_after as
          | { count?: number; period?: string }
          | null;
        entry.filter = criteria.filter as string | null;
      }

      return entry;
    });
  }
}
