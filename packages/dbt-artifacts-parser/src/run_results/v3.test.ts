import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-ignore - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);
import { HttpsSchemasGetdbtComDbtRunResultsV3Json } from "./v3";

describe("run_results v3", () => {
  it("should parse run_results.json correctly", () => {
    const jsonPath = path.join(
      __dirname,
      "../tests/resources/run_results/v3/jaffle_shop/run_results.json",
    );
    const jsonContent = fs.readFileSync(jsonPath, "utf-8");
    const parsed = JSON.parse(
      jsonContent,
    ) as HttpsSchemasGetdbtComDbtRunResultsV3Json;

    expect(parsed).toBeDefined();
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.dbt_schema_version).toBeDefined();
    expect(parsed.results).toBeDefined();
    expect(Array.isArray(parsed.results)).toBe(true);
    expect(parsed.elapsed_time).toBeDefined();
    expect(typeof parsed.elapsed_time).toBe("number");

    // Validate a sample result
    if (parsed.results.length > 0) {
      const firstResult = parsed.results[0];
      expect(firstResult).toBeDefined();
      expect(firstResult.status).toBeDefined();
      expect(firstResult.unique_id).toBeDefined();
      expect(firstResult.timing).toBeDefined();
      expect(Array.isArray(firstResult.timing)).toBe(true);
    }
  });
});
