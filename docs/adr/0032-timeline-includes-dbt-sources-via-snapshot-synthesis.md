# 32. Timeline includes dbt sources via snapshot synthesis

Date: 2026-03-31

## Status

Accepted

Relates to [26. Default-hidden tests and time-range brush for scalable timeline performance](0026-default-hidden-tests-and-time-range-brush-for-timeline.md) (timeline canvas and performance trade-offs)

Relates to [18. Hybrid dbt-first catalog and runs workspace for dbt-tools web](0018-hybrid-dbt-first-catalog-and-runs-workspace-for-dbt-tools-web.md) (Runs / execution analysis surface)

Relates to [24. Union parent_map and depends_on for ManifestGraph edges](0024-union-parent-map-and-depends-on-for-manifestgraph-edges.md) (edge direction: upstream dep → dependent)

## Context

The execution timeline is built primarily from **`run_results.json`**: a row exists only when dbt recorded **compile/execute timing** with both `started_at` and `completed_at`. For a typical **`dbt run`**, **`source` nodes are usually not executed** that way, so they often **never appear** in raw Gantt data.

The codebase already **synthesizes** a `source` row when **tests** resolve (via manifest/graph) to a **source parent**, aggregating test timing. In practice, many schema tests attach to **models**, not sources, so that path leaves most sources invisible.

Operators still expect **sources** on the timeline when those sources are **part of the executed DAG** (models reference them via `source()`), so the UI should not depend solely on dbt emitting timed `source.*` results.

## Decision

**Invariant:** During `@dbt-tools/core` analysis snapshot construction, every manifest **`source`** node that satisfies all of the following gets a **`GanttItem`** row if one is not already present:

1. The node exists on the **Graphology** graph with `resource_type` **source**.
2. **Package scope:** The snapshot’s `projectName` (and synthetic-source filtering) use **`buildTimelineProjectName`**: use **`metadata.project_name`** when at least one **non-test, non-macro** execution uses that package; otherwise use the **dominant package among those executions**, excluding a small **denylist** of add-on packages (currently `elementary`) from the mode so they do not eclipse the root project. Tests/macros are skipped for these counts. This avoids dropping in-scope sources when `metadata.project_name` is wrong or when the manifest name does not match executed packages.
3. **Direct executed dependents:** The source has at least one **direct** outbound neighbor (in dbt’s dependency direction: **ref → consumer**) that already has a timeline row from **`run_results`** enrichment, and that neighbor is **not** a test or unit test.
4. **Timing:** The synthetic row’s `start` / `end` (relative ms, consistent with existing Gantt items) are the **min** / **max** over those dependents’ intervals. **Status** uses the same severity-based **representative** merge as test-aggregated synthetic sources. **Compile/execute phase fields** stay **null** (honest: no direct source execution interval from `run_results`).

**Ordering:** Run **after** the existing **test-on-source** synthesis pass, using the **combined** row list as input, so rows are not duplicated.

**Non-goals (v1):** Synthesizing sources with **no** timed direct dependents (would require placeholders or full-manifest listing; separate product decision). **Transitive** aggregation across the whole DAG (would over-inflate bars).

## Consequences

**Positive:** Sources that matter for executed models appear in the timeline and type legend without requiring timed `source` entries in `run_results`.

**Negative / risks:** Large projects with many `source()` refs can add **more timeline rows**; combined with [ADR 0026](0026-default-hidden-tests-and-time-range-brush-for-timeline.md) virtualization, cost stays bounded, but **initial row count** grows.

## Alternatives considered

1. **Rely on dbt only** — Rejected: normal `dbt run` artifacts often omit timed source rows; timeline would stay empty for sources.
2. **Transitive descendant aggregation** — Rejected for v1: bars could span unrelated wall-clock windows; direct edges match declared `depends_on`.
3. **Manifest-only placeholders for every source** — Rejected for v1: noisy on partial runs and duplicates catalog concerns.

## References

- Snapshot Gantt enrichment and synthesis live in `@dbt-tools/core` (`analysis-snapshot-gantt`, `analysis-snapshot-build`).
- Web timeline filters (`PRIMARY_TIMELINE_TYPES`, default package scoping) remain in `@dbt-tools/web` analysis-workspace helpers.
- The Timeline lens may surface a **manifest graph vs this run vs timeline** count table (`invocationResourceStats`) so operators can compare `source` (and other types) across those views.
