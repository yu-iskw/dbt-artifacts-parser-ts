import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { parseFreshness, parseFreshnessV0 } from "./index";

// @ts-expect-error - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);

function loadJaffleFreshness(): Record<string, unknown> {
  const jsonPath = path.join(
    __dirname,
    "../../resources/freshness/v0/jaffle_shop/freshness.json",
  );
  return JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Record<
    string,
    unknown
  >;
}

describe("freshness parser", () => {
  it("keeps Pass, Warn, and Error and reports resource_type", () => {
    const input = loadJaffleFreshness();
    const freshness = parseFreshness(input);

    expect(freshness).toBe(input);
    expect(parseFreshnessV0(input)).toBe(input);
    expect(freshness.metadata.dbt_schema_version).toBe(
      "https://schemas.getdbt.com/dbt/freshness/v0.json",
    );
    expect(freshness.results.map((row) => row.status).sort()).toEqual([
      "Error",
      "Pass",
      "Warn",
    ]);
    expect(freshness.results.map((row) => row.resource_type)).toEqual([
      "source",
      "source",
      "source",
    ]);
  });

  it("rejects a sources document", () => {
    expect(() =>
      parseFreshness({
        metadata: {
          dbt_schema_version: "https://schemas.getdbt.com/dbt/sources/v3.json",
        },
      }),
    ).toThrow("Not a freshness.json");
  });

  it("falls back to v0 only when asked", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const newer = {
      metadata: {
        dbt_schema_version: "https://schemas.getdbt.com/dbt/freshness/v1.json",
      },
      results: [{ status: "Pass", resource_type: "model" }],
    };

    expect(() => parseFreshness(newer)).toThrow(
      "Unsupported freshness version: 1",
    );
    expect(parseFreshness(newer, { fallbackToLatest: true })).toBe(newer);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("falling back to latest supported schema 'v0'"),
    );
    expect(() => parseFreshnessV0(newer)).toThrow("Not a freshness.json v0");
    warnSpy.mockRestore();
  });
});
