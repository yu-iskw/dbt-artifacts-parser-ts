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

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${PACKAGE_DIR}/../.." && pwd)"
RESOURCES_DIR="${PACKAGE_DIR}/resources"
SRC_DIR="${PACKAGE_DIR}/src"
JSON2TS="${ROOT_DIR}/node_modules/.bin/json2ts"
PREPROCESS_REFs="${SCRIPT_DIR}/preprocess-refs.js"
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "${TEMP_DIR}"' EXIT

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Generating TypeScript types from JSON schemas...${NC}"

# Ensure src subdirectories exist (do not blanket-delete v*.ts: partial schema
# check-ins only regenerate the versions backed by resources/<category>/*.json)
for dir in catalog manifest run_results sources semantic_manifest; do
	mkdir -p "${SRC_DIR}/${dir}"
done

# Function to process a category
# Args: category_name, src_output_dir, [schema_dir]
# When schema_dir is omitted, defaults to resources/<category>/ (legacy layout).
# JSON Schemas checked in for codegen live under resources/json-schema/<category>/
# so they are not picked up as manifest/run_results artifact fixtures by test-utils.
process_category() {
	local category=$1
	local output_dir=$2
	local resource_dir=${3:-"${RESOURCES_DIR}/${category}"}

	if [[ ! -d ${resource_dir} ]]; then
		echo -e "${BLUE}Skipping ${category} (directory not found)${NC}"
		return
	fi

	echo -e "${BLUE}Processing ${category}...${NC}"
	mkdir -p "${output_dir}"

	# Process each JSON file in the category
	for json_file in "${resource_dir}"/*.json; do
		if [[ ! -f ${json_file} ]]; then
			continue
		fi

		# Extract version number from filename (e.g., manifest_v12.json -> 12)
		local basename
		basename=$(basename "${json_file}" .json)
		local version
		version=$(echo "${basename}" | sed -E 's/.*_v([0-9]+)$/\1/')

		if [[ -z ${version} ]]; then
			echo -e "Warning: Could not extract version from ${json_file}, skipping"
			continue
		fi

		local output_file="${output_dir}/v${version}.ts"
		echo -e "  Generating ${output_file} from $(basename "${json_file}")"

		# Pre-process JSON file (will expand $ref if needed, or copy as-is)
		# This handles root-level $ref patterns that json2ts can't process
		local temp_json_file
		temp_json_file="${TEMP_DIR}/$(basename "${json_file}")"
		if ! node "${PREPROCESS_REFs}" "${json_file}" "${temp_json_file}" "${resource_dir}" >/dev/null; then
			echo -e "  Error: Failed to pre-process ${json_file}, skipping"
			continue
		fi

		# Generate TypeScript file using json2ts
		# Use --cwd to help resolve $ref references
		# Use --unreachableDefinitions to generate all $defs
		if ! "${JSON2TS}" \
			--input "${temp_json_file}" \
			--output "${output_file}" \
			--cwd "${resource_dir}" \
			--unknownAny \
			--unreachableDefinitions \
			--format; then
			echo -e "  Error: Failed to generate ${output_file}, skipping"
			continue
		fi

		# json-schema-to-typescript 15+ may emit a file-level eslint-disable; this repo
		# requires paired eslint-comments directives, so drop the banner line.
		if [[ -f ${output_file} ]]; then
			local first_line
			first_line=$(head -n 1 "${output_file}") || true
			if [[ ${first_line} == "/* eslint-disable */" ]]; then
				local stripped_file
				stripped_file="${TEMP_DIR}/stripped_$(basename "${output_file}")"
				tail -n +2 "${output_file}" >"${stripped_file}"
				mv "${stripped_file}" "${output_file}"
			fi
		fi
	done

	# Category index.ts files (re-exports, parse helpers, Parsed* unions) are
	# hand-maintained — this script only regenerates vN.ts from *_vN.json.
}

# Process each category
process_category "catalog" "${SRC_DIR}/catalog"
process_category "manifest" "${SRC_DIR}/manifest" "${RESOURCES_DIR}/json-schema/manifest"
process_category "run-results" "${SRC_DIR}/run_results" "${RESOURCES_DIR}/json-schema/run-results"
process_category "sources" "${SRC_DIR}/sources"
process_category "semantic_manifest" "${SRC_DIR}/semantic_manifest"

# Generate root index.ts
# Don't re-export everything to avoid naming conflicts between categories
# Users should import from specific categories: import { Type } from 'dbt-artifacts-parser/manifest'
echo -e "${BLUE}Generating root index.ts...${NC}"
{
	echo "// dbt-artifacts-parser"
	echo "//"
	echo "// Import from specific categories to avoid naming conflicts:"
	echo "//   import { WritableManifest } from 'dbt-artifacts-parser/manifest'"
	echo "//   import { WritableManifest } from 'dbt-artifacts-parser/manifest/v12' (for specific version)"
	echo "//   import { CatalogArtifact } from 'dbt-artifacts-parser/catalog'"
	echo "//   import { RunResultsArtifact } from 'dbt-artifacts-parser/run_results'"
	echo "//   import { FreshnessExecutionResultArtifact } from 'dbt-artifacts-parser/sources'"
	echo ""
	echo "// Re-export catalog (latest version)"
	if [[ -f "${SRC_DIR}/catalog/index.ts" ]]; then
		echo "export * from './catalog';"
	fi
} >"${SRC_DIR}/index.ts"

echo -e "${GREEN}Type generation complete!${NC}"
