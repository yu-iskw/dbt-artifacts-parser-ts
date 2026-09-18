import { describe, it, expect } from "vitest";
import { parseFreshnessV0 } from "./index";
import { loadTestFreshness } from "../test-utils";

describe("freshness v0", () => {
  it("parses the Fusion compat fixture", () => {
    const raw = loadTestFreshness(
      "v0",
      "freshness_fusion.json",
      "compat",
    ) as Record<string, unknown>;
    const parsed = parseFreshnessV0(raw);

    expect(parsed.metadata.dbt_schema_version).toBe(
      "https://schemas.getdbt.com/dbt/freshness/v0.json",
    );
    expect(parsed.results).toHaveLength(3);
    expect(parsed.results[0]?.unique_id).toBe("model.compat.stg_orders");
    expect(parsed.results[0]?.status).toBe("Pass");
    expect(parsed.results[1]?.criteria.loaded_at_query).toContain(
      "source('raw', 'orders')",
    );
  });
});
