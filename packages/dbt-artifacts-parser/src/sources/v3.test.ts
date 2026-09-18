import { describe, it, expect } from "vitest";
import { parseSourcesV3 } from "./index";
import { loadTestSources } from "../test-utils";
import type { SourceFreshnessOutput } from "./v3";

function asOutput(row: unknown): SourceFreshnessOutput {
  return row as SourceFreshnessOutput;
}

describe("sources v3", () => {
  it("keeps Core lowercase statuses including runtime error", () => {
    const raw = loadTestSources("v3", "sources_core.json", "compat") as Record<
      string,
      unknown
    >;
    const parsed = parseSourcesV3(raw);

    expect(parsed.metadata.dbt_version).toBe("1.12.0");
    expect(asOutput(parsed.results[0]).status).toBe("pass");
    expect(parsed.results[1]).toMatchObject({
      unique_id: "source.compat.raw.payments",
      status: "runtime error",
    });
  });

  it("maps Fusion PascalCase sources statuses onto the published v3 enum", () => {
    const raw = loadTestSources(
      "v3",
      "sources_fusion.json",
      "compat",
    ) as Record<string, unknown>;
    const parsed = parseSourcesV3(raw);

    expect(parsed.metadata.dbt_version).toBe("2.0.0");
    expect(parsed.results.map((row) => asOutput(row).status)).toEqual([
      "pass",
      "warn",
      "error",
    ]);
  });
});
