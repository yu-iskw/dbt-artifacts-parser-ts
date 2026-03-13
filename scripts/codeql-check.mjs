#!/usr/bin/env node
/**
 * Pre-check for CodeQL CLI. Exits with installation instructions if not found.
 */

import { spawnSync } from "node:child_process";

const r = spawnSync("codeql", ["version"], { encoding: "utf8", stdio: "pipe" });
if (r.status !== 0 || r.error) {
  console.error("CodeQL CLI not found. Install it first:");
  console.error("  macOS:   brew install codeql");
  console.error(
    "  or see:  https://github.com/github/codeql-cli-binaries/releases",
  );
  process.exit(1);
}
