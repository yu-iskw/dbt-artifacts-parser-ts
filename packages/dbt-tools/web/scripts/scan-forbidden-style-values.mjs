#!/usr/bin/env node
/**
 * Guardrail: fail if design-system TSX contains raw hex/rgb(a) literals (use tokens / CSS vars).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DS_DIR = path.resolve(__dirname, "../src/design-system");

const HEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const RGB = /\brgba?\(\s*\d+/;

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".tsx")) out.push(p);
  }
}

function main() {
  const files = [];
  walk(DS_DIR, files);
  let failed = false;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
      if (HEX.test(line) || RGB.test(line)) {
        console.error(`${path.relative(process.cwd(), file)}:${i + 1}: forbidden raw color literal`);
        failed = true;
      }
    });
  }
  if (failed) process.exit(1);
  console.log("Design-system style literal scan OK");
}

main();
