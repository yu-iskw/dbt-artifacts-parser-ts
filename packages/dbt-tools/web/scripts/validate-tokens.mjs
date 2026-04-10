#!/usr/bin/env node
/**
 * Token JSON validation: unique cssVar names, required fields, dark overrides reference known vars.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const TOKENS_DIR = path.join(PKG_ROOT, "tokens");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** @param {Record<string, unknown>} obj @param {string[]} pathParts */
function walk(obj, pathParts, onLeaf) {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("$")) continue;
    if (v === null || typeof v !== "object" || Array.isArray(v)) continue;
    const node = /** @type {Record<string, unknown>} */ (v);
    if ("$value" in node) {
      onLeaf(node, [...pathParts, k].join("."));
    } else {
      walk(/** @type {Record<string, unknown>} */ (v), [...pathParts, k], onLeaf);
    }
  }
}

function collectSemantics() {
  const dir = path.join(TOKENS_DIR, "semantics");
  /** @type {Map<string, string>} */
  const cssVarToPath = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const data = readJson(path.join(dir, f));
    walk(data, [`semantics/${f}`], (leaf, p) => {
      const ext = /** @type {{ dbt?: { cssVar?: string } }} */ (leaf).$extensions?.dbt;
      const name = ext?.cssVar;
      if (!name) return;
      if (cssVarToPath.has(name)) {
        throw new Error(`Duplicate semantic cssVar "${name}" (${p} vs ${cssVarToPath.get(name)})`);
      }
      if (!leaf.$type) throw new Error(`Missing $type at ${p}`);
      cssVarToPath.set(name, p);
    });
  }
  return cssVarToPath;
}

function collectComponents() {
  const dir = path.join(TOKENS_DIR, "components");
  /** @type {Map<string, string>} */
  const cssVarToPath = new Map();
  if (!fs.existsSync(dir)) return cssVarToPath;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const data = readJson(path.join(dir, f));
    walk(data, [`components/${f}`], (leaf, p) => {
      const ext = /** @type {{ dbt?: { cssVar?: string, cssVarRef?: string } }} */ (leaf)
        .$extensions?.dbt;
      const name = ext?.cssVar;
      if (!name) return;
      if (cssVarToPath.has(name)) {
        throw new Error(`Duplicate component cssVar "${name}"`);
      }
      if (!ext.cssVarRef && !leaf.$type) {
        throw new Error(`Missing $type at ${p} (no cssVarRef)`);
      }
      cssVarToPath.set(name, p);
    });
  }
  return cssVarToPath;
}

function validateDark(knownSemantic) {
  const data = readJson(path.join(TOKENS_DIR, "themes", "dark.json"));
  const list = data.overrides;
  if (!Array.isArray(list)) throw new Error("themes/dark.json must have overrides array");
  for (const row of list) {
    if (!row?.cssVar || typeof row.$value !== "string") {
      throw new Error(`Invalid dark override entry: ${JSON.stringify(row)}`);
    }
    if (!knownSemantic.has(row.cssVar)) {
      throw new Error(
        `Dark override references unknown cssVar "${row.cssVar}" — add to semantics or remove`,
      );
    }
  }
}

function main() {
  const semantics = collectSemantics();
  collectComponents();
  validateDark(semantics);
  console.log("Token JSON validation OK");
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
