# 33. Materialization semantics as a first-class analysis field

Date: 2026-04-05

## Status

Accepted

## Context

Users interpret run timing, lineage, and SQL differently depending on how dbt materializes a resource (`table`, `view`, `incremental`, `ephemeral`, etc.). The workspace already copied `config.materialized` onto the manifest graph and into Gantt rows, but **resource lists, runs, and health** did not share a consistent normalized model, so materialization could not drive filters, tooltips, or aggregates reliably.

`run_results.json` does not expose materialization; semantics must stay **manifest-derived** (adapter-safe wording in UI).

## Decision

1. Introduce **`NodeExecutionSemantics`** and **`MaterializationKind`** in `@dbt-tools/core`, built by a single pure helper from `resource_type`, graph/`manifest` config (including incremental hints), and optional project adapter label.
2. Attach **`semantics`** to **`ResourceNode`**, **`ExecutionRow`**, and **`GanttItem`** during snapshot construction so Runs, Explorer, Timeline, and Health read the same object for a given `unique_id`.
3. In `@dbt-tools/web`, use **compact dashed badges** (not status colors alone) plus manifest-sourced filters on Runs and Explorer; timeline legend adds a **read-only materialization row**; health adds a **model-only distribution** card.

**Explicit non-goals:** infer warehouse-specific behavior not present in artifacts; claim `run_result` provenance for materialization.

## Consequences

**Positive:**

- Consistent semantics across lenses; fewer “why does this row look odd?” support questions.
- Filters and search can target materialization without string-matching `config.materialized`.

**Negative / risks:**

- Custom adapter materializations map to `unknown` with optional `rawMaterialization`—users must read tooltips for exact manifest strings.
- Requires rebuilding `@dbt-tools/core` so `dist/` types expose new fields to the web package.

## Alternatives considered

- **Badge-only / copy in one screen:** Rejected—would not fix filters, health, or cross-lens consistency.
- **Parser-only normalization without core snapshot fields:** Rejected—web would still duplicate logic or drift from CLI/worker consumers.

## References

- Core: `packages/dbt-tools/core/src/analysis/node-execution-semantics.ts`, snapshot builders under `analysis/snapshot/`.
- Web: `MaterializationSemanticsBadge`, `materializationSemanticsUi.ts`, Runs/Explorer filters, `HealthMaterializationCard`, `GanttLegend` materialization group.
