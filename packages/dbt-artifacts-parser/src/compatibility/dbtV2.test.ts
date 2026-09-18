import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { parseRunResults, parseRunResultsV6 } from "../run_results";
import { parseSources, parseSourcesV3 } from "../sources";

// @ts-expect-error - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);

function loadFixture(relativePath: string): Record<string, unknown> {
  const fixturePath = path.join(__dirname, "../../resources", relativePath);
  return JSON.parse(fs.readFileSync(fixturePath, "utf-8")) as Record<
    string,
    unknown
  >;
}

describe("dbt v2 producer compatibility", () => {
  it.each([
    ["Pass", "pass"],
    ["Warn", "warn"],
    ["Error", "error"],
  ])(
    "normalizes sources/v3 freshness status %s to %s",
    (wireStatus, canonicalStatus) => {
      const artifact = loadFixture(
        "sources/v3/dbt_v2/sources_2.0.4_compat.json",
      );
      const results = artifact.results as Record<string, unknown>[];
      results[0] = { ...results[0], status: wireStatus };
      const original = JSON.stringify(artifact);

      const parsed = parseSourcesV3(artifact);

      expect(parsed.results[0]?.status).toBe(canonicalStatus);
      expect(JSON.stringify(artifact)).toBe(original);
    },
  );

  it("normalizes dbt v2 status through automatic version detection", () => {
    const artifact = loadFixture(
      "sources/v3/dbt_v2/sources_2.0.4_compat.json",
    );

    const parsed = parseSources(artifact);

    expect(parsed.results[0]?.status).toBe("pass");
  });

  it("preserves static_analysis_off_reason in run-results/v6", () => {
    const artifact = loadFixture(
      "run_results/v6/dbt_v2/run_results_2.0.4_compat.json",
    );

    const parsed = parseRunResultsV6(artifact);

    expect(parsed.results[0]?.static_analysis_off_reason).toBe("configuredoff");
  });

  it("preserves dbt v2 run-result fields through automatic detection", () => {
    const artifact = loadFixture(
      "run_results/v6/dbt_v2/run_results_2.0.4_compat.json",
    );

    const parsed = parseRunResults(artifact);
    const firstResult = parsed.results[0] as unknown as Record<string, unknown>;

    expect(firstResult.static_analysis_off_reason).toBe("configuredoff");
  });
});
