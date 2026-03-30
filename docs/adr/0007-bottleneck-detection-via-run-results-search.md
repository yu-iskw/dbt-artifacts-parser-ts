# 7. Bottleneck detection via run results search

Date: 2026-03-13

## Status

Accepted

Extends [30. Adapter response metrics in analysis snapshot and run-report](0030-adapter-response-metrics-in-analysis-snapshot-and-run-report.md)

## Context

Users need to identify performance bottlenecks in dbt run results. The existing `ExecutionAnalyzer` provides critical path and Gantt data, but lacks a generalized way to search and filter run results, or to surface the slowest models. A reusable search abstraction would support bottleneck detection today and future analyses (failed nodes, slow-model dashboards, etc.) without duplicating logic.

## Decision

We introduce a generalized run-results search layer and implement bottleneck detection on top of it.

1. **Generalized search**: Add `searchRunResults(executions, criteria)` in `@dbt-tools/core`. Criteria support: `min_execution_time`, `max_execution_time`, `status`, `unique_id_pattern`, `sort`, `limit`. Pure function, easy to test.

2. **Bottleneck detection**: Add `detectBottlenecks(executions, options)` that uses `searchRunResults`. Two modes: `top_n` (top N slowest by execution time) and `threshold` (nodes exceeding N seconds). Optional `ManifestGraph` enriches results with node names.

3. **CLI exposure**: Extend `run-report` with `--bottlenecks`, `--bottlenecks-top <n>` (default 10), and `--bottlenecks-threshold <s>`. Cannot use both top and threshold. When `--bottlenecks` is set, append bottleneck section to report (human-readable) or add `bottlenecks` key to JSON.

4. **Formatting**: Add `formatBottlenecks` and extend `formatRunReport` to accept optional bottlenecks. Structured output is JSON-serializable for future MCP and web consumers.

### Architecture

```mermaid
flowchart TD
    subgraph core [@dbt-tools/core]
        RR[run_results.json] --> EA[ExecutionAnalyzer]
        M[manifest.json] --> MG[ManifestGraph]
        EA --> NE[getNodeExecutions]
        MG --> EA
        NE --> SR[searchRunResults]
        SR --> BD[detectBottlenecks]
        BD --> BR[BottleneckResult]
        EA --> GS[getSummary]
        EA --> GD[getGanttData]
    end

    subgraph cli [@dbt-tools/cli]
        RRcmd[run-report] --> EA
        RRcmd --> BD
        BF[formatRunReport] --> GS
        BF --> BR
    end

    subgraph future [Future Consumers]
        MCP[MCP Tools]
        Web[Web App]
    end

    BR -.->|JSON| MCP
    GD -.->|Gantt data| Web
    BR -.->|JSON| Web
```

## Consequences

**Positive:**

- Extensible for failed-node search, slow-model dashboards, and multi-run comparison.
- Single source of truth for run-results filtering.
- Pure functions in core; no side effects; easy to test.
- Future MCP and web app can consume same structured output.

**Negative:**

- Additional complexity in run-report command.

**Mitigations:**

- Clear validation: error if both `--bottlenecks-top` and `--bottlenecks-threshold` provided.
- Schema introspection updated for agent discoverability.

## References

- [ADR-0006](0006-artifact-first-agent-first-positioning-of-dbt-tools.md) — performance analysis in Tier 2 roadmap
