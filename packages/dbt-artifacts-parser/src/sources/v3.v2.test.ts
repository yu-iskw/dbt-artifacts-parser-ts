import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-expect-error - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);
import { parseSourcesV3 } from "./index";

describe("sources v3 dbt v2", () => {
  it("should parse sources_v2.json and lowercase Pass/Warn/Error", () => {
    const jsonPath = path.join(
      __dirname,
      "../../resources/sources/v3/jaffle_shop",
      "sources_v2.json",
    );
    const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Record<
      string,
      unknown
    >;
    const firstRaw = (raw.results as Array<Record<string, unknown>>)[0];
    expect(firstRaw.status).toBe("Pass");

    const parsed = parseSourcesV3(raw);
    expect(parsed.metadata.dbt_schema_version).toContain("/sources/v3.json");
    expect(String(parsed.metadata.dbt_version).startsWith("2.")).toBe(true);
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results[0].status).toBe("pass");
  });
});
