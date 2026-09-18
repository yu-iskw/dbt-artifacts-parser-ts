import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// @ts-expect-error - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);

function readJson(relPath: string): Record<string, unknown> {
  const fullPath = path.join(__dirname, "../../", relPath);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8")) as Record<
    string,
    unknown
  >;
}

function readText(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, "../../", relPath), "utf-8");
}

describe("published artifact schema contracts", () => {
  it("keeps freshness v0 statuses in the published PascalCase enum", () => {
    const schema = readJson(
      "resources/json-schema/freshness/freshness_v0.json",
    );
    const results = schema.properties as Record<string, unknown>;
    const items = (results.results as Record<string, unknown>).items as Record<
      string,
      unknown
    >;
    const status = (items.properties as Record<string, unknown>).status as {
      enum: string[];
    };

    expect(schema.$id).toBe("https://schemas.getdbt.com/dbt/freshness/v0.json");
    expect(status.enum).toEqual(["Pass", "Warn", "Error"]);
    expect(readText("src/freshness/v0.ts")).toContain(
      'status: "Pass" | "Warn" | "Error"',
    );
    expect(readText("src/freshness/v0.ts")).toContain(
      "DO NOT MODIFY IT BY HAND",
    );
  });

  it("keeps sources v3 statuses in the published lowercase enum", () => {
    const schema = readJson("resources/json-schema/sources/sources_v3.json");
    const results = schema.properties as Record<string, unknown>;
    const anyOf = (
      (results.results as Record<string, unknown>).items as Record<
        string,
        unknown
      >
    ).anyOf as Array<Record<string, unknown>>;
    const outputStatus = (
      (anyOf[1]?.properties as Record<string, unknown>).status as {
        enum: string[];
      }
    ).enum;

    expect(outputStatus).toEqual(["pass", "warn", "error", "runtime error"]);
    expect(readText("src/sources/v3.ts")).toContain(
      'status: "pass" | "warn" | "error" | "runtime error"',
    );
    expect(readText("src/sources/v3.ts")).toContain("DO NOT MODIFY IT BY HAND");
  });
});
