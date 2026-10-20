import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// @ts-expect-error - import.meta is available in Vitest ESM context
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "../..");

function exportedCategories(): string[] {
  const manifest = JSON.parse(
    readFileSync(path.join(packageRoot, "package.json"), "utf8"),
  ) as { exports: Record<string, { default?: string } | string> };
  const categories: string[] = [];
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    if (subpath === ".") {
      continue;
    }
    const spec = typeof target === "string" ? target : target.default;
    const match = /^\.\/dist\/(.+)\/index\.js$/.exec(spec ?? "");
    if (match !== null) {
      categories.push(match[1]);
    }
  }
  return categories;
}

function mentions(document: string, category: string): boolean {
  const normalized = document.toLowerCase().replace(/-/g, "_");
  return normalized.includes(category.toLowerCase().replace(/-/g, "_"));
}

describe("category registration", () => {
  it("names every exported category in the README and the parser-refresh skill", () => {
    const readme = readFileSync(path.join(packageRoot, "README.md"), "utf8");
    const skill = readFileSync(
      path.join(repoRoot, ".claude/skills/dbt-parser-refresh/SKILL.md"),
      "utf8",
    );
    const missing = exportedCategories().filter(
      (category) => !mentions(readme, category) || !mentions(skill, category),
    );

    expect(missing).toEqual([]);
  });
});
