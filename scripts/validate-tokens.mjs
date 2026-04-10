#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const webRoot = path.join(repoRoot, "packages/dbt-tools/web");
const tokenRoot = path.join(webRoot, "tokens");

const guardedDirs = ["packages/dbt-tools/web/src/design-system"];

const guardedFiles = [
  "packages/dbt-tools/web/src/styles/app.css",
  "packages/dbt-tools/web/src/styles/design-system.css",
  "packages/dbt-tools/web/src/index.css",
];

const guardedExt = new Set([".tsx", ".ts", ".css"]);
const allowedFiles = new Set([
  "packages/dbt-tools/web/src/lib/tokens.ts",
  "packages/dbt-tools/web/src/lib/tailwind-theme-bridge.ts",
  "packages/dbt-tools/web/src/styles/tokens.css",
  "packages/dbt-tools/web/src/styles/theme.css",
]);

const forbiddenPatterns = [
  { label: "hex color", regex: /#[0-9a-fA-F]{3,8}\b/g },
  { label: "pixel literal", regex: /\b\d+px\b/g },
  { label: "rgba/rgb literal", regex: /\brgba?\(/g },
];

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolute)));
      continue;
    }
    if (!guardedExt.has(path.extname(entry.name))) continue;
    files.push(absolute);
  }
  return files;
}

function validateTokenTree(node, nodePath, findings) {
  if (!node || typeof node !== "object") return;
  const maybeToken = "value" in node || "type" in node;
  if (maybeToken) {
    if (!("value" in node) || !("type" in node)) {
      findings.push(
        `${nodePath.join(".")}: token leaves must define both value and type`,
      );
    }
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    validateTokenTree(value, [...nodePath, key], findings);
  }
}

async function validateTokenSchema(findings) {
  const tokenFiles = [
    "primitives/color.json",
    "primitives/space.json",
    "primitives/border.json",
    "primitives/radius.json",
    "primitives/typography.json",
    "primitives/shadow.json",
    "primitives/motion.json",
    "primitives/z-index.json",
    "semantics/color.json",
    "components/button.json",
    "components/input.json",
    "themes/light.json",
    "themes/dark.json",
  ];

  for (const rel of tokenFiles) {
    const absolute = path.join(tokenRoot, rel);
    try {
      const json = JSON.parse(await fs.readFile(absolute, "utf8"));
      validateTokenTree(json, [rel], findings);
    } catch (error) {
      findings.push(`${rel}: unable to parse token JSON (${String(error)})`);
    }
  }
}

const findings = [];
await validateTokenSchema(findings);

const filesToCheck = [];
for (const dir of guardedDirs) {
  const absolute = path.join(repoRoot, dir);
  filesToCheck.push(...(await listFiles(absolute)));
}
for (const rel of guardedFiles) {
  filesToCheck.push(path.join(repoRoot, rel));
}

for (const file of filesToCheck) {
  const rel = path.relative(repoRoot, file);
  if (allowedFiles.has(rel)) continue;
  const text = await fs.readFile(file, "utf8");
  for (const { label, regex } of forbiddenPatterns) {
    if (regex.test(text)) {
      findings.push(`${rel}: found forbidden ${label}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Token validation failed:\n" + findings.join("\n"));
  process.exit(1);
}

console.log("Token validation passed for schema and guarded UI paths.");
