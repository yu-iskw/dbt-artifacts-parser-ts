import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-ignore - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);
import { Manifest } from "./v1";

describe("manifest v2", () => {
  it("should parse manifest.json correctly", () => {
    const jsonPath = path.join(
      __dirname,
      "../tests/resources/manifest/v2/jaffle_shop/manifest.json",
    );
    const jsonContent = fs.readFileSync(jsonPath, "utf-8");
    const parsed = JSON.parse(jsonContent) as Manifest;

    expect(parsed).toBeDefined();
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.dbt_schema_version).toBeDefined();
    expect(parsed.nodes).toBeDefined();
    expect(typeof parsed.nodes).toBe("object");
    expect(parsed.sources).toBeDefined();
    expect(typeof parsed.sources).toBe("object");
    expect(parsed.macros).toBeDefined();
    expect(typeof parsed.macros).toBe("object");

    // Validate a sample node
    const nodeKeys = Object.keys(parsed.nodes);
    if (nodeKeys.length > 0) {
      const firstNodeKey = nodeKeys[0];
      const firstNode = parsed.nodes[firstNodeKey];
      expect(firstNode).toBeDefined();
      expect(firstNode.unique_id).toBeDefined();
    }
  });
});
