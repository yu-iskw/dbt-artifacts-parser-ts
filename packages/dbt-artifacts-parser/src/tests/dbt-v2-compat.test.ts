import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseManifestV12 } from "../manifest";
import { parseSources } from "../sources";
import { parseFreshness } from "../freshness";
import { loadTestSources, loadTestFreshness } from "../test-utils";

// @ts-expect-error - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const MANIFEST_V12_URL = "https://schemas.getdbt.com/dbt/manifest/v12.json";

describe("dbt v2 JSON compatibility contracts", () => {
  it("still parses Core 1.12 fixtures and retains macros and unit tests", () => {
    const jsonPath = path.join(
      __dirname,
      "../../resources/manifest/v12/jaffle_shop/manifest_1.12.json",
    );
    const manifest = parseManifestV12(
      JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Record<string, unknown>,
    );

    expect(manifest.metadata.dbt_version).toBe("1.12.0");
    expect(Object.keys(manifest.macros).length).toBeGreaterThan(0);
    expect(Object.keys(manifest.unit_tests).length).toBeGreaterThan(0);
    expect(
      Object.values(manifest.unit_tests).some(
        (unitTest) => "overrides" in unitTest,
      ),
    ).toBe(true);
  });

  it("dispatches on dbt_schema_version even when dbt_version is 2.0.0", () => {
    const manifest = parseManifestV12({
      metadata: {
        dbt_schema_version: MANIFEST_V12_URL,
        dbt_version: "2.0.0",
      },
      nodes: {
        "model.compat.stg_orders": {
          unique_id: "model.compat.stg_orders",
          resource_type: "model",
          config: { tags: ["nightly"] },
          depends_on: {
            nodes: ["source.compat.raw.orders"],
            nodes_with_ref_location: [
              { unique_id: "source.compat.raw.orders" },
            ],
          },
        },
      },
      macros: {
        "macro.compat.generate_schema_name": {
          unique_id: "macro.compat.generate_schema_name",
          arguments: [{ name: "custom_schema_name" }],
        },
      },
      unit_tests: {
        "unit_test.compat.stg_orders": {
          unique_id: "unit_test.compat.stg_orders",
          overrides: { macros: null },
        },
      },
    } as Record<string, unknown>);

    expect(manifest.metadata.dbt_schema_version).toBe(MANIFEST_V12_URL);
    expect(manifest.metadata.dbt_version).toBe("2.0.0");

    const node = manifest.nodes["model.compat.stg_orders"] as unknown as {
      config: { tags: string[] };
      depends_on: { nodes_with_ref_location: unknown };
    };
    expect(node.config.tags).toEqual(["nightly"]);
    expect(node.depends_on.nodes_with_ref_location).toEqual([
      { unique_id: "source.compat.raw.orders" },
    ]);

    const unitTest = manifest.unit_tests[
      "unit_test.compat.stg_orders"
    ] as unknown as { overrides: { macros: null } };
    expect(unitTest.overrides).toEqual({ macros: null });
  });

  it("does not parse freshness.json as sources.json or lowercase freshness statuses", () => {
    const freshnessRaw = loadTestFreshness(
      "v0",
      "freshness_fusion.json",
      "compat",
    ) as Record<string, unknown>;

    expect(() => parseSources(freshnessRaw)).toThrow("Not a sources.json");

    const freshness = parseFreshness(freshnessRaw);
    expect(freshness.results[0]?.status).toBe("Pass");
  });

  it("parses Fusion sources.json as sources v3 after status normalization", () => {
    const sourcesRaw = loadTestSources(
      "v3",
      "sources_fusion.json",
      "compat",
    ) as Record<string, unknown>;

    expect(() => parseFreshness(sourcesRaw)).toThrow("Not a freshness.json");

    const sources = parseSources(sourcesRaw);
    expect(sources.metadata.dbt_schema_version).toContain("/sources/v3.json");
    expect(
      (sources.results as Array<{ status: string }>).map((row) => row.status),
    ).toEqual(["pass", "warn", "error"]);
  });
});
