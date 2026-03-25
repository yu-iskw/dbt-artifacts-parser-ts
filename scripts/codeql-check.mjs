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

const queryPack = process.argv[2];

if (queryPack) {
  const resolve = spawnSync("codeql", ["resolve", "queries", queryPack], {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (resolve.status !== 0 || resolve.error) {
    console.error(`CodeQL query pack '${queryPack}' is not available locally.`);
    console.error("Run the download-enabled analyze script once when online:");
    console.error("  pnpm codeql:analyze:download");
    process.exit(1);
  }
}
