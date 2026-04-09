import { describe, it, expect } from "vitest";
import { SourceFreshnessAnalyzer } from "./source-freshness-analyzer";
import type { ParsedSources } from "dbt-artifacts-parser/sources";

describe("SourceFreshnessAnalyzer", () => {
  const mockSources: ParsedSources = {
    metadata: {
      dbt_schema_version:
        "https://schemas.getdbt.com/dbt/sources/v3.json",
      dbt_version: "1.8.0",
      generated_at: "2024-04-09T00:00:00Z",
    },
    results: [
      {
        unique_id: "source.my_project.raw.orders",
        max_loaded_at: "2024-04-08T12:00:00Z",
        snapshotted_at: "2024-04-09T00:00:00Z",
        max_loaded_at_time_ago_in_s: 43200,
        status: "pass",
        criteria: {
          warn_after: { count: 1, period: "day" },
          error_after: { count: 3, period: "day" },
        },
        adapter_response: {},
        timing: [],
        thread_id: "1",
        execution_time: 1.5,
      },
      {
        unique_id: "source.my_project.raw.customers",
        max_loaded_at: "2024-04-07T00:00:00Z",
        snapshotted_at: "2024-04-09T00:00:00Z",
        max_loaded_at_time_ago_in_s: 86400 * 2,
        status: "warn",
        criteria: {
          warn_after: { count: 1, period: "day" },
          error_after: { count: 3, period: "day" },
        },
        adapter_response: {},
        timing: [],
        thread_id: "2",
        execution_time: 2.0,
      },
      {
        unique_id: "source.my_project.raw.products",
        error: "Connection timeout",
        status: "runtime error",
      },
    ] as unknown as (
      | import("dbt-artifacts-parser/sources").SourceFreshnessOutput
      | import("dbt-artifacts-parser/sources").SourceFreshnessRuntimeError
    )[],
    elapsed_time: 5.5,
  };

  describe("summarize", () => {
    it("should return a summary with all sources", () => {
      const analyzer = new SourceFreshnessAnalyzer(mockSources);
      const summary = analyzer.summarize();

      expect(summary.total).toBe(3);
      expect(summary.counts_by_status).toEqual({
        pass: 1,
        warn: 1,
        "runtime error": 1,
      });
      expect(summary.entries).toHaveLength(3);
    });

    it("should normalize source entries correctly", () => {
      const analyzer = new SourceFreshnessAnalyzer(mockSources);
      const summary = analyzer.summarize();
      const orderEntry = summary.entries.find(
        (e) => e.unique_id === "source.my_project.raw.orders",
      );

      expect(orderEntry).toBeDefined();
      expect(orderEntry?.name).toBe("orders");
      expect(orderEntry?.source_name).toBe("raw");
      expect(orderEntry?.package_name).toBe("my_project");
      expect(orderEntry?.status).toBe("pass");
      expect(orderEntry?.age_seconds).toBe(43200);
      expect(orderEntry?.execution_time).toBe(1.5);
    });

    it("should handle runtime error entries", () => {
      const analyzer = new SourceFreshnessAnalyzer(mockSources);
      const summary = analyzer.summarize();
      const errorEntry = summary.entries.find(
        (e) => e.unique_id === "source.my_project.raw.products",
      );

      expect(errorEntry).toBeDefined();
      expect(errorEntry?.status).toBe("runtime error");
      expect(errorEntry?.message).toBe("Connection timeout");
      expect(errorEntry?.execution_time).toBeUndefined();
    });
  });

  describe("filterByStatus", () => {
    it("should filter entries by status", () => {
      const analyzer = new SourceFreshnessAnalyzer(mockSources);
      const summary = analyzer.filterByStatus(["warn"]);

      expect(summary.total).toBe(1);
      expect(summary.counts_by_status).toEqual({ warn: 1 });
      expect(summary.entries).toHaveLength(1);
      expect(summary.entries[0].status).toBe("warn");
    });

    it("should filter multiple statuses", () => {
      const analyzer = new SourceFreshnessAnalyzer(mockSources);
      const summary = analyzer.filterByStatus(["pass", "warn"]);

      expect(summary.total).toBe(2);
      expect(summary.entries).toHaveLength(2);
    });
  });

  describe("enrichWithManifest", () => {
    it("should enrich entries with manifest data", () => {
      const mockManifest = {
        metadata: { dbt_version: "1.8.0" },
        nodes: {},
        sources: {
          "source.my_project.raw.orders": {
            path: "sources.yml",
            original_file_path: "models/sources.yml",
            tags: ["daily", "critical"],
            description: "Customer orders from the raw database",
          },
        },
        macros: {},
        exposures: {},
      } as unknown as Parameters<
        typeof SourceFreshnessAnalyzer.prototype.enrichWithManifest
      >[0];

      const analyzer = new SourceFreshnessAnalyzer(mockSources);
      const summary = analyzer.enrichWithManifest(mockManifest);
      const orderEntry = summary.entries.find(
        (e) => e.unique_id === "source.my_project.raw.orders",
      );

      expect(orderEntry?.resource_type).toBe("source");
      expect(orderEntry?.path).toBe("sources.yml");
      expect(orderEntry?.original_file_path).toBe("models/sources.yml");
      expect(orderEntry?.tags).toEqual(["daily", "critical"]);
      expect(orderEntry?.description).toBe(
        "Customer orders from the raw database",
      );
    });

    it("should handle missing manifest entries gracefully", () => {
      const mockManifest = {
        metadata: { dbt_version: "1.8.0" },
        nodes: {},
        sources: {},
        macros: {},
        exposures: {},
      } as unknown as Parameters<
        typeof SourceFreshnessAnalyzer.prototype.enrichWithManifest
      >[0];

      const analyzer = new SourceFreshnessAnalyzer(mockSources);
      const summary = analyzer.enrichWithManifest(mockManifest);

      expect(summary.entries).toHaveLength(3);
      // Entries without manifest data should not be enriched
      const orderEntry = summary.entries.find(
        (e) => e.unique_id === "source.my_project.raw.orders",
      );
      expect(orderEntry?.resource_type).toBeUndefined();
    });
  });

  describe("empty sources", () => {
    it("should handle empty results gracefully", () => {
      const emptySources: ParsedSources = {
        metadata: {
          dbt_schema_version:
            "https://schemas.getdbt.com/dbt/sources/v3.json",
        },
        results: [],
        elapsed_time: 0,
      };

      const analyzer = new SourceFreshnessAnalyzer(emptySources);
      const summary = analyzer.summarize();

      expect(summary.total).toBe(0);
      expect(summary.counts_by_status).toEqual({});
      expect(summary.entries).toHaveLength(0);
    });
  });
});
