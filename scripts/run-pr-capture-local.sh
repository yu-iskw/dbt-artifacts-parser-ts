#!/usr/bin/env bash
# Full local PR-style capture: resolve manifest from git diff, then build + record WebM + PNG.
# Equivalent to: pnpm run capture:resolve && pnpm run capture:record
# Usage (repo root):
#   pnpm capture:pr
#   BASE_REF=origin/main pnpm capture:pr
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

bash "${ROOT}/scripts/pr-capture-resolve.sh"

pnpm run capture:record

echo ""
echo "Artifacts: packages/dbt-tools/web/pr-capture-artifacts/screenshots/ and .../videos/"
