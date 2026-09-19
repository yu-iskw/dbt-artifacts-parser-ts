import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-expect-error - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);
import { parseFreshnessV0 } from "./index";

const FIXTURES = ["freshness.json"] as const;

describe("freshness v0", () => {
  it.each(FIXTURES)("should parse %s correctly", (fixture) => {
    const jsonPath = path.join(
      __dirname,
      "../../resources/freshness/v0/jaffle_shop",
      fixture,
    );
    const jsonContent = fs.readFileSync(jsonPath, "utf-8");
    const raw = JSON.parse(jsonContent) as Record<string, unknown>;
    const parsed = parseFreshnessV0(raw);

    expect(parsed).toBeDefined();
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.dbt_schema_version).toBe(
      "https://schemas.getdbt.com/dbt/freshness/v0.json",
    );
    expect(parsed.metadata.dbt_version).toBe("2.0.0");
    expect(parsed.results).toBeDefined();
    expect(Array.isArray(parsed.results)).toBe(true);
    expect(parsed.elapsed_time).toBeDefined();
    expect(typeof parsed.elapsed_time).toBe("number");

    expect(parsed.results.length).toBeGreaterThan(0);
    const resourceTypes = parsed.results.map((result) => result.resource_type);
    expect(resourceTypes).toContain("source");
    expect(resourceTypes).toContain("model");
  });
});
