#!/usr/bin/env bash
# Resolve PR capture manifest from git diff vs BASE_REF (default: main).
# Writes packages/dbt-tools/web/pr-capture-changed-files.txt and pr-capture-artifacts/capture-manifest.json
# Usage (repo root): pnpm run capture:resolve
#   BASE_REF=origin/main pnpm run capture:resolve
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

BASE_REF="${BASE_REF:-main}"
CHANGED="${ROOT}/packages/dbt-tools/web/pr-capture-changed-files.txt"

git diff --name-only "${BASE_REF}"...HEAD >"${CHANGED}"

pnpm exec tsx packages/dbt-tools/web/scripts/resolve-pr-capture-targets.ts \
	--changed "${CHANGED}"
