import { describe, it, expect, vi } from "vitest";
import type { ParsedFreshness } from "./index";
import { parseFreshness, parseFreshnessV0 } from "./index";
import { loadTestFreshness } from "../test-utils";

const FRESHNESS_V0_URL = "https://schemas.getdbt.com/dbt/freshness/v0.json";
const ERR_NOT_FRESHNESS = "Not a freshness.json";
const ERR_NOT_FRESHNESS_V0 = "Not a freshness.json v0";

const mockFreshnessV0 = {
  metadata: {
    dbt_schema_version: FRESHNESS_V0_URL,
    dbt_version: "2.0.0",
    generated_at: "2026-09-18T00:00:00.000000Z",
    invocation_id: "00000000-0000-0000-0000-000000000333",
  },
  results: [],
  elapsed_time: 0,
};

describe("freshness parser", () => {
  describe("parseFreshness", () => {
    it("parses freshness v0 including version 0 as a real schema major", () => {
      const freshness = parseFreshness(mockFreshnessV0);

      expect(freshness.metadata.dbt_schema_version).toBe(FRESHNESS_V0_URL);
      expect(freshness.results).toEqual([]);
      expect(freshness.elapsed_time).toBe(0);
    });

    it("throws for invalid freshness documents", () => {
      expect(() => parseFreshness({})).toThrow(ERR_NOT_FRESHNESS);
      expect(() => parseFreshness({ metadata: {} })).toThrow(ERR_NOT_FRESHNESS);
      expect(() =>
        parseFreshness({
          metadata: {
            dbt_schema_version:
              "https://schemas.getdbt.com/dbt/sources/v3.json",
          },
        }),
      ).toThrow(ERR_NOT_FRESHNESS);
    });

    it("throws for unsupported freshness versions", () => {
      expect(() =>
        parseFreshness({
          metadata: {
            dbt_schema_version:
              "https://schemas.getdbt.com/dbt/freshness/v1.json",
          },
        }),
      ).toThrow("Unsupported freshness version: 1");
    });

    it("falls back to v0 when fallbackToLatest is true", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const newer = {
        ...mockFreshnessV0,
        metadata: {
          ...mockFreshnessV0.metadata,
          dbt_schema_version:
            "https://schemas.getdbt.com/dbt/freshness/v1.json",
        },
      };

      const freshness = parseFreshness(newer, { fallbackToLatest: true });
      expect(freshness).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("falling back to latest supported schema 'v0'"),
      );
      warnSpy.mockRestore();
    });
  });

  describe("parseFreshnessV0", () => {
    it("parses v0 documents", () => {
      const freshness = parseFreshnessV0(mockFreshnessV0);
      expect(freshness.metadata.dbt_schema_version).toBe(FRESHNESS_V0_URL);
    });

    it("rejects other artifact schema URLs", () => {
      expect(() =>
        parseFreshnessV0({
          metadata: {
            dbt_schema_version:
              "https://schemas.getdbt.com/dbt/sources/v3.json",
          },
        }),
      ).toThrow(ERR_NOT_FRESHNESS_V0);
    });
  });

  describe("ParsedFreshness", () => {
    it("accepts parsed v0 documents", () => {
      const freshness: ParsedFreshness = parseFreshness(mockFreshnessV0);
      expect(freshness.metadata.dbt_schema_version).toContain(
        "/freshness/v0.json",
      );
    });
  });

  describe("compat fixture", () => {
    it("keeps published PascalCase statuses and resource_type", () => {
      const raw = loadTestFreshness(
        "v0",
        "freshness_fusion.json",
        "compat",
      ) as Record<string, unknown>;
      const freshness = parseFreshness(raw);

      expect(freshness.results.map((row) => row.status)).toEqual([
        "Pass",
        "Warn",
        "Error",
      ]);
      expect(freshness.results.map((row) => row.resource_type)).toEqual([
        "model",
        "source",
        "source",
      ]);
    });
  });
});
