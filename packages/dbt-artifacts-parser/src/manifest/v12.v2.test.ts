import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-expect-error - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);
import { parseManifestV12 } from "./index";

describe("manifest v12 dbt v2", () => {
  it("should parse manifest_v2.json", () => {
    const jsonPath = path.join(
      __dirname,
      "../../resources/manifest/v12/jaffle_shop",
      "manifest_v2.json",
    );
    const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Record<
      string,
      unknown
    >;
    const nodes = raw.nodes as Record<string, Record<string, unknown>>;
    const firstRawNode = Object.values(nodes)[0];
    // Engine may emit classifiers; published schema v12 does not define it.
    expect(firstRawNode).toHaveProperty("classifiers");

    const parsed = parseManifestV12(raw);
    expect(parsed.metadata.dbt_schema_version).toContain("/manifest/v12.json");
    expect(String(parsed.metadata.dbt_version).startsWith("2.")).toBe(true);
    expect(parsed.nodes).toBeDefined();
  });
});
