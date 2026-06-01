#!/bin/bash

# Copyright 2025 yu-iskw
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Download pinned dbt artifact JSON schemas from https://schemas.getdbt.com/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${PACKAGE_DIR}/../.." && pwd)"
RESOURCES_DIR="${PACKAGE_DIR}/resources"
SCHEMAS_MANIFEST="${SCRIPT_DIR}/schemas.json"

if [[ ! -f ${SCHEMAS_MANIFEST} ]]; then
	echo "Missing schemas manifest: ${SCHEMAS_MANIFEST}" >&2
	exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
	echo "curl is required to download schemas" >&2
	exit 1
fi

if ! command -v node >/dev/null 2>&1; then
	echo "node is required to validate downloaded JSON" >&2
	exit 1
fi

entry_count="$(node -e "
const fs = require('fs');
const entries = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
if (!Array.isArray(entries)) {
  console.error('schemas.json must be a JSON array');
  process.exit(1);
}
for (const [i, entry] of entries.entries()) {
  if (!entry || typeof entry.url !== 'string' || typeof entry.out !== 'string') {
    console.error('Invalid entry at index ' + i + ': expected { url, out }');
    process.exit(1);
  }
  if (entry.out.includes('..') || entry.out.startsWith('/')) {
    console.error('Invalid out path at index ' + i + ': ' + entry.out);
    process.exit(1);
  }
}
console.log(entries.length);
" "${SCHEMAS_MANIFEST}")"

echo "Fetching ${entry_count} schema file(s) from schemas.getdbt.com..."

node -e "
const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');

const resourcesDir = process.argv[1];
const manifestPath = process.argv[2];
const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

for (const { url, out } of entries) {
  const dest = path.join(resourcesDir, out);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  execFileSync('curl', ['-f', '-S', '-L', '-o', dest, url], { stdio: 'inherit' });
  JSON.parse(fs.readFileSync(dest, 'utf8'));
  console.log('Downloaded ' + out);
}
" "${RESOURCES_DIR}" "${SCHEMAS_MANIFEST}"

if [[ -d ${ROOT_DIR}/node_modules ]]; then
	echo "Formatting vendored schemas (Trunk)..."
	(
		cd "${ROOT_DIR}"
		pnpm exec trunk fmt \
			"${RESOURCES_DIR}/catalog" \
			"${RESOURCES_DIR}/manifest" \
			"${RESOURCES_DIR}/run-results" \
			"${RESOURCES_DIR}/sources"
	)
else
	echo "Skipping Trunk format (run pnpm install at repo root, then re-run fetch:schemas)" >&2
fi

echo "Schema fetch complete."
