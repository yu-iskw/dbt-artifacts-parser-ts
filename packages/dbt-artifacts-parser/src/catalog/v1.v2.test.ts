import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-expect-error - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);
import { parseCatalogV1 } from "./index";

describe("catalog v1 dbt v2", () => {
  it("should parse catalog_v2.json", () => {
    const jsonPath = path.join(
      __dirname,
      "../../resources/catalog/v1/jaffle_shop",
      "catalog_v2.json",
    );
    const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Record<
      string,
      unknown
    >;
    const parsed = parseCatalogV1(raw);
    expect(parsed.metadata.dbt_schema_version).toContain("/catalog/v1.json");
    expect(String(parsed.metadata.dbt_version).startsWith("2.")).toBe(true);
  });
});
