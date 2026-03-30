#!/usr/bin/env bash
# Temporary helper: run Gemini CLI with a problem-solving prompt for @dbt-tools/web
# scale/performance (very large dbt projects). Delete when finished.
#
# Usage:
#   ./tmp-gemini-web-scale-problem-solving.sh
#   GEMINI_APPROVAL_MODE=auto_edit ./tmp-gemini-web-scale-problem-solving.sh
#
# Requires: gemini CLI on PATH. YOLO/auto_edit auto-approves tool use per Gemini;
# use auto_edit if you want a less permissive default.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPROVAL_MODE="${GEMINI_APPROVAL_MODE:-yolo}"

if [[ ${APPROVAL_MODE} != "yolo" && ${APPROVAL_MODE} != "auto_edit" ]]; then
	echo "GEMINI_APPROVAL_MODE must be yolo or auto_edit (got: ${APPROVAL_MODE})" >&2
	exit 1
fi

echo "Using --approval-mode ${APPROVAL_MODE}" >&2
if [[ ${APPROVAL_MODE} == "yolo" ]]; then
	echo "Warning: yolo auto-approves edits and shell. Prefer auto_edit for read-mostly analysis." >&2
fi

cd "${ROOT}"

prompt_text=$(
	cat <<'PROMPT'
You are analyzing the repository at the working directory (a pnpm monorepo).

## Product / stack context (ground truth for suggestions)
- Frontend: package `@dbt-tools/web` under `packages/dbt-tools/web` — Vite, React, Recharts, `@tanstack/react-virtual`.
- Workspace also includes `packages/dbt-tools/core`, CLI, and `dbt-artifacts-parser`.
- The analyzer UI lives under `packages/dbt-tools/web/src/components/AnalysisWorkspace/` and related `lib/analysis-workspace/` (tree, lineage, overview, timeline/Gantt, explorer).
- Users may load dbt artifacts representing **very large** projects: on the order of **hundreds of thousands** of dbt resources (models, tests, sources, etc.). The goal is **interactive** performance: scrolling, search, filtering, lineage/graph views, and timeline must remain usable.

## Stated problem (X)
Improve web app performance so it works with extremely large dbt projects (many thousands / hundreds of thousands of resources).

## Your task: structured problem-solving (not a shallow tip list)
Follow this methodology exactly:

1. **Intent & issue**
   - State **Stated Problem (X)** and infer **Underlying Intent (Y)** (e.g. perceived vs root bottlenecks: memory, main-thread JS, rendering, data shape, network, parsing).
   - **XY problem check**: Is “make React faster” missing a better lever (e.g. data model, pagination, worker, incremental indexes)?
   - **Context & impact**: What breaks first at scale in this kind of SPA (virtualization limits, graph layout, JSON parse, immutable updates, etc.)?

2. **Approaches**: Propose **5** distinct approaches that address **(Y)**. Include at least one that **bypasses** a naive “optimize components only” path (e.g. server-side aggregation, lazy artifact slices, Web Worker parsing, indexed search).

3. **Criteria**: Define **4–6** scoring dimensions relevant to this codebase (e.g. Feasibility in Vite/React, Performance at 100k+ nodes, Maintainability, UX fidelity, Security/offline constraints, Migration cost).

4. **Scoring**: For each approach, score each criterion **0–100** and compute an average. Justify briefly in text.

5. **Report format**: Output a single Markdown document using this exact section structure (fill every section):

# Intent & Issue Analysis Report

## 1. Intent & Issue Analysis

### Stated Problem (X)
### Underlying Intent (Y)
### XY Problem Check
### Context & Impact

## 2. Evaluation Criteria
(list criteria with one line each)

## 3. Approaches
### Approach 1: [Name]
- **Description**:
- **Pros**:
- **Cons**:
(repeat for Approaches 2–5)

## 4. Scoring Matrix
| Approach | [criterion1] | [criterion2] | ... | Average |

## 5. Recommendation
(One primary recommendation + optional phased rollout. Tie recommendations to **specific** areas of this repo when you can infer them from file names and patterns—e.g. virtualized lists, graph library, artifact parsing path.)

## Execution hints for the agent
- Prefer **reading** the codebase to ground recommendations (AnalysisWorkspace, analysis-workspace lib, parsers, state management). Do not invent file paths; if unsure, say what to verify.
- Call out **measurement** first: what to profile (Chrome Performance, React Profiler, memory snapshots) and what metrics matter (TTI of large load, scroll FPS, time to first interaction).
PROMPT
)

exec gemini --model gemini-3.1-pro-preview -p "${prompt_text}" \
	--approval-mode "${APPROVAL_MODE}"
