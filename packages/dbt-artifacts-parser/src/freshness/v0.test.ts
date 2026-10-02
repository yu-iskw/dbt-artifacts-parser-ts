import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-expect-error - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);
import { parseFreshness, parseFreshnessV0 } from "./index";

describe("freshness v0", () => {
  it("should parse dbt v2 freshness_v2.json", () => {
    const jsonPath = path.join(
      __dirname,
      "../../resources/freshness/v0/jaffle_shop",
      "freshness_v2.json",
    );
    const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Record<
      string,
      unknown
    >;
    const parsed = parseFreshness(raw);
    const metadata = parsed.metadata;

    expect(metadata.dbt_schema_version).toBe(
      "https://schemas.getdbt.com/dbt/freshness/v0.json",
    );
    expect(metadata.dbt_version.startsWith("2.")).toBe(true);
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results[0].status).toBe("Pass");
    expect(parseFreshnessV0(raw).metadata.dbt_version).toBe(
      metadata.dbt_version,
    );
  });
});
