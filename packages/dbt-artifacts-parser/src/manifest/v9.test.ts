import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-expect-error - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);
import { parseManifestV9 } from "./index";

describe("manifest v9", () => {
  it("should parse jaffle_shop_at_1.5rc1 manifest.json correctly", () => {
    const jsonPath = path.join(
      __dirname,
      "../../resources/manifest/v9/jaffle_shop_at_1.5rc1/manifest.json",
    );
    const jsonContent = fs.readFileSync(jsonPath, "utf-8");
    const raw = JSON.parse(jsonContent) as Record<string, unknown>;
    const parsed = parseManifestV9(raw);

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
