import { describe, expect, it, vi } from "vitest";
import {
  identityCast,
  parseByVersion,
  slot,
  versionTable,
} from "./versionTable";

const FRESHNESS_SCHEMA = /\/freshness\/v(\d+)\.json$/;

function freshnessSlot(version: number) {
  return slot<Record<string, unknown>>({
    version,
    exactFragment: `/freshness/v${version}.json`,
    mismatch: `Not a freshness.json v${version}`,
    cast: identityCast(),
  });
}

function parseFreshness(
  parsed: Record<string, unknown>,
  options?: { fallbackToLatest?: boolean },
) {
  return parseByVersion({
    table: versionTable([freshnessSlot(0)]),
    schemaPattern: FRESHNESS_SCHEMA,
    notArtifactMessage: "Not a freshness.json",
    unsupportedLabel: "freshness",
    parsed,
    options,
  });
}

describe("VersionTable", () => {
  it("rejects an empty table, a duplicate key, and a negative version", () => {
    expect(() => versionTable([])).toThrow(
      "Version table requires at least one slot",
    );
    expect(() => versionTable([freshnessSlot(0), freshnessSlot(0)])).toThrow(
      "Duplicate version 0",
    );
    expect(() => versionTable([freshnessSlot(-1)])).toThrow(
      "Version must be a non-negative integer",
    );
  });

  it("uses 0 as the max when version 0 is the only slot", () => {
    const table = versionTable([freshnessSlot(0)]);
    const parsed = {
      metadata: {
        dbt_schema_version: "https://schemas.getdbt.com/dbt/freshness/v0.json",
      },
    };

    expect(table.maxVersion).toBe(0);
    expect(table.exact(0)(parsed)).toBe(parsed);
    expect(table.get(1)).toBeUndefined();
    expect(() => table.exact(1)).toThrow("No slot for version 1");
    expect(parseFreshness(parsed)).toBe(parsed);
  });

  it("falls back through the latest cast only when the version is newer", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const parsed = {
      metadata: {
        dbt_schema_version: "https://schemas.getdbt.com/dbt/freshness/v1.json",
      },
    };

    expect(() => parseFreshness(parsed)).toThrow(
      "Unsupported freshness version: 1",
    );
    expect(parseFreshness(parsed, { fallbackToLatest: true })).toBe(parsed);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("falling back to latest supported schema 'v0'"),
    );
    warnSpy.mockRestore();
  });

  it("does not treat a gap below the max as a newer schema", () => {
    const table = versionTable([freshnessSlot(0), freshnessSlot(2)]);
    const parsed = {
      metadata: {
        dbt_schema_version: "https://schemas.getdbt.com/dbt/freshness/v1.json",
      },
    };

    expect(table.maxVersion).toBe(2);
    expect(() =>
      parseByVersion({
        table,
        schemaPattern: FRESHNESS_SCHEMA,
        notArtifactMessage: "Not a freshness.json",
        unsupportedLabel: "freshness",
        parsed,
        options: { fallbackToLatest: true },
      }),
    ).toThrow("Unsupported freshness version: 1");
  });
});
