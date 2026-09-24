import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-expect-error - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);
import { parseRunResultsV6 } from "./index";

describe("run_results v6 dbt v2", () => {
  it("should parse run_results_v2.json", () => {
    const jsonPath = path.join(
      __dirname,
      "../../resources/run_results/v6/jaffle_shop",
      "run_results_v2.json",
    );
    const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Record<
      string,
      unknown
    >;
    const parsed = parseRunResultsV6(raw);
    expect(parsed.metadata.dbt_schema_version).toContain(
      "/run-results/v6.json",
    );
    expect(String(parsed.metadata.dbt_version).startsWith("2.")).toBe(true);
  });
});
