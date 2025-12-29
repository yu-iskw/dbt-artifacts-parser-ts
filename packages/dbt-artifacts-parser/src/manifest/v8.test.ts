import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-ignore - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);
import { HttpsSchemasGetdbtComDbtManifestV8Json } from "./v8";

describe("manifest v8", () => {
  it("should parse jaffle_shop manifest.json correctly", () => {
    const jsonPath = path.join(
      __dirname,
      "../tests/resources/manifest/v8/jaffle_shop/manifest.json",
    );
    const jsonContent = fs.readFileSync(jsonPath, "utf-8");
    const parsed = JSON.parse(
      jsonContent,
    ) as HttpsSchemasGetdbtComDbtManifestV8Json;

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

  it("should parse jaffle_shop_at_1_4_3 manifest.json correctly", () => {
    const jsonPath = path.join(
      __dirname,
      "../tests/resources/manifest/v8/jaffle_shop_at_1_4_3/manifest.json",
    );
    const jsonContent = fs.readFileSync(jsonPath, "utf-8");
    const parsed = JSON.parse(
      jsonContent,
    ) as HttpsSchemasGetdbtComDbtManifestV8Json;

    expect(parsed).toBeDefined();
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.dbt_schema_version).toBeDefined();
    expect(parsed.nodes).toBeDefined();
    expect(typeof parsed.nodes).toBe("object");
    expect(parsed.sources).toBeDefined();
    expect(typeof parsed.sources).toBe("object");
    expect(parsed.macros).toBeDefined();
    expect(typeof parsed.macros).toBe("object");
  });
});
