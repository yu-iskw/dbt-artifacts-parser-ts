# Artifact Console Boundaries

Product positioning for dbt-tools (operational intelligence layer, web usable without AI, CLI/core as structured interfaces) is recorded in [ADR-0008](../adr/0008-dbt-tools-operational-intelligence-and-positioning-boundaries.md).

## Phase 1 rules

- `@dbt-tools/core` owns artifact parsing, manifest graph construction, execution analysis, bottleneck detection, and serializable analysis snapshot building.
- `packages/dbt-tools/web/src/workers` owns transport and off-main-thread execution only. Workers call the core browser facade and return serializable payloads.
- `packages/dbt-tools/web/src/lib/analysis-workspace` owns pure UI-adjacent derivations from `AnalysisState` and view state.
- `packages/dbt-tools/web/src/components` and `packages/dbt-tools/web/src/hooks` own rendering, URL state, and worker/service orchestration only.

## Guardrail

ESLint blocks React hooks/components from importing core graph primitives directly. New artifact-domain logic should land in `@dbt-tools/core` or in pure `analysis-workspace` modules, not inside React files.
