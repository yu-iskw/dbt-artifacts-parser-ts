#!/usr/bin/env bash
# Render Code Scanning YAML from assets/code-scanning-config.template.yml for a repository.
# Merges CODEQL_PATHS_IGNORE, extra CLI paths, and optional existence-based paths-ignore.
# Docs: https://aka.ms/code-scanning-docs/config-file
set -euo pipefail

usage() {
	echo "Usage: $0 <repo-root> <output-yaml> [extra-path-to-ignore ...]" >&2
	echo "Env: CODEQL_CONFIG_NAME (override name), CODEQL_PATHS_IGNORE (comma-separated)," >&2
	echo "     CODEQL_CONFIG_REPO_SCAN=0|false to skip auto paths-ignore from repo layout" >&2
	exit 2
}

[[ $# -ge 2 ]] || usage
REPO=$(cd "$1" && pwd)
OUT="$2"
shift 2

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SKILL_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
TEMPLATE="${SKILL_ROOT}/assets/code-scanning-config.template.yml"

if [[ ! -f ${TEMPLATE} ]]; then
	echo "Missing template: ${TEMPLATE}" >&2
	exit 1
fi

CONFIG_NAME=${CODEQL_CONFIG_NAME-}
if [[ -z ${CONFIG_NAME} ]]; then
	if top=$(git -C "${REPO}" rev-parse --show-toplevel 2>/dev/null); then
		CONFIG_NAME=$(basename "${top}")
	else
		CONFIG_NAME=local-codeql
	fi
fi

paths_tmp=$(mktemp)
tmp_out=$(mktemp)
cleanup() {
	rm -f "${paths_tmp}" "${tmp_out}"
}
trap cleanup EXIT

add_path() {
	local p="${1//[$'\t\r\n']/}"
	p=$(echo "${p}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
	[[ -z ${p} ]] && return
	if [[ -s ${paths_tmp} ]] && grep -Fxq "${p}" "${paths_tmp}" 2>/dev/null; then
		return
	fi
	echo "${p}" >>"${paths_tmp}"
}

if [[ -n ${CODEQL_PATHS_IGNORE-} ]]; then
	IFS=',' read -r -a _parts <<<"${CODEQL_PATHS_IGNORE}"
	for p in "${_parts[@]}"; do
		add_path "${p}"
	done
fi

for p in "$@"; do
	add_path "${p}"
done

_scan=${CODEQL_CONFIG_REPO_SCAN:-1}
if [[ ${_scan} == "1" || ${_scan} == "true" ]]; then
	[[ -d "${REPO}/node_modules" ]] && add_path "node_modules"
	[[ -d "${REPO}/.git" ]] && add_path ".git"
	if [[ -d "${REPO}/dist" ]] || compgen -G "${REPO}/packages/"*/dist >/dev/null 2>&1; then
		add_path "**/dist"
	fi
	[[ -d "${REPO}/coverage" ]] && add_path "coverage"
	[[ -d "${REPO}/codeql-db" ]] && add_path "codeql-db"
	[[ -d "${REPO}/playwright-report" ]] && add_path "playwright-report"
	[[ -d "${REPO}/test-results" ]] && add_path "test-results"
fi

if [[ -s ${paths_tmp} ]]; then
	sort -u "${paths_tmp}" -o "${paths_tmp}"
fi
path_count=0
if [[ -s ${paths_tmp} ]]; then
	path_count=$(wc -l <"${paths_tmp}" | tr -d ' ')
fi

{
	while IFS= read -r line || [[ -n ${line-} ]]; do
		if [[ ${line} =~ ^name:[[:space:]] ]]; then
			echo "name: ${CONFIG_NAME}"
		else
			printf '%s\n' "${line}"
		fi
	done <"${TEMPLATE}"

	if [[ ${path_count} -gt 0 ]]; then
		echo "paths-ignore:"
		while IFS= read -r p || [[ -n ${p-} ]]; do
			[[ -z ${p-} ]] && continue
			echo "  - ${p}"
		done <"${paths_tmp}"
	fi
} >"${tmp_out}"

mv "${tmp_out}" "${OUT}"
trap - EXIT
rm -f "${paths_tmp}"
echo "Wrote ${OUT}" >&2
