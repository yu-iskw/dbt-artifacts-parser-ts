import { readFileSync } from "node:fs";
import path from "node:path";

export function createSharedSourceEntryAliases(projectRoot) {
  const packageJsonPath = path.resolve(
    projectRoot,
    "packages/dbt-artifacts-parser/package.json",
  );
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const aliases = {};
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    if (subpath === ".") {
      continue;
    }
    const spec = typeof target === "string" ? target : target.default;
    const match = /^\.\/dist\/(.+)\/index\.js$/.exec(spec ?? "");
    if (match === null) {
      continue;
    }
    const category = match[1];
    aliases[`dbt-artifacts-parser/${category}`] = path.resolve(
      projectRoot,
      "packages/dbt-artifacts-parser/src",
      category,
      "index.ts",
    );
  }
  return aliases;
}
