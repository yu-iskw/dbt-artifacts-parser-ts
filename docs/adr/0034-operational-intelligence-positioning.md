# 34. Operational intelligence positioning for dbt-tools

Date: 2026-04-09

## Status

Accepted

Builds-on: [6. Artifact-first agent-first positioning of dbt-tools](0006-artifact-first-agent-first-positioning-of-dbt-tools.md)

## Context

dbt-tools provides a suite of CLI, web, and library tools for analyzing dbt artifacts. Early positioning emphasized "agent-first design"—optimization for AI agents consuming outputs. However, this framing risks:

1. **Underselling operator value**: The deterministic analysis (critical path, bottleneck detection, build order, execution timelines, adapter metrics) is directly actionable for human operators without requiring AI.
2. **Positioning as AI copilot**: "Agent-optimized" language can imply LLM dependence, which is incorrect. dbt-tools delivers full value without any AI/LLM integration.
3. **Misaligned differentiation**: Comparisons to dbt Cloud or generic observability SaaS matter less than clarity on what this tool **is** (deterministic operational intelligence layer).
4. **Composability undersold**: The library and CLI are designed as stable, reusable contracts—not merely support infrastructure for a single UI.

The codebase **already implements** the capabilities needed for a clearer positioning; we need to reorient messaging to match substance.

## Decision

We adopt a **deterministic-first, human-and-agent** positioning for dbt-tools:

### 1. Core thesis

**External positioning:** "dbt-tools is a dbt operational intelligence layer"

**Internal positioning:** "a composable analysis substrate for dbt artifacts that serves both operators and agents"

**Unified thesis:** "dot-tools turns dbt artifacts into deterministic operational intelligence for humans and agents"

### 2. What "operational intelligence" means

Structured analysis derived entirely from artifacts:

- **Dependency intelligence**: Build order, upstream/downstream traversal, subgraph focus, cycle detection
- **Execution intelligence**: Critical path calculation, bottleneck ranking, Gantt timeline visualization, per-node metrics
- **Performance intelligence**: Adapter-agnostic cost and performance metrics (bytes, slots, row counts, query IDs per warehouse)
- **Readiness intelligence**: Artifact freshness, completeness (manifest-only vs full), materialization kinds
- **Inventory intelligence**: Resource listing, tagging, search, filtering by type, package, path

All analysis is **deterministic**: same artifact input always produces identical output.

### 3. Who uses dbt-tools and why

**Operators (humans via web UI and CLI):**

- Investigate critical paths and bottlenecks for optimization
- Understand execution parallelism and resource dependencies
- Assess artifact freshness and data readiness
- Browse and discover resources at scale
- Diagnose slow or failing runs without dbt Cloud

**Agents / automation (via CLI and library):**

- Structured, machine-readable outputs (JSON, schema introspection)
- Field filtering for context window optimization
- Error codes for programmatic error handling
- Build order for orchestration workflows
- Dependency intelligence for impact analysis
- No AI/LLM required; outputs feed into deterministic automation

### 4. What dbt-tools is NOT

Explicit non-goals:

- **Not dbt Cloud**: No execution, no platform integration, no admin APIs
- **Not an observability SaaS**: No real-time monitoring, no alerting, no external dependencies
- **Not an AI copilot / chat tool**: No LLM integration, no generated prose, no conversational interface
- **Not merely a graph viewer**: Analysis-backed, deterministic outputs for downstream use
- **Not a replacement for dbt-mcp**: No SQL execution, no semantic layer, no LSP, no live project features

### 5. Composability and future extensibility

Core library and CLI are designed as **stable, embeddable, reusable contracts**:

- Library: imported as analysis engine for other tools
- CLI: consumed by agent orchestration frameworks, CI scripts, other tools
- Structured outputs: composable with other agent skills (cost analysis, warehouse metadata, CI context)

dbt-tools intentionally avoids vendor lock-in or speculative SaaS features. Operators and agents are enabled to integrate it into their own workflows.

### 6. Message hierarchy for documentation

1. **What it is**: dbt operational intelligence layer
2. **What it does**: transforms artifacts into structured dependency, execution, readiness intelligence
3. **Who it serves**: operators (web/CLI) and agents (CLI/library)
4. **Why it matters**: deterministic, actionable, composable, local-first, no AI required
5. **What it's not**: explicit non-goals listed above

## Consequences

**Positive:**

- Clearer differentiation: "deterministic operational intelligence" is distinct from platforms, SaaS, and chat tools
- Honest value prop: emphasizes human-accessible value without AI/LLM
- Honest about scope: agents are supported through stable structured interfaces, not as primary positioning
- Empowers operators: highlights workflows and actions, not just "visualization"
- Enables composability: library and CLI are recognized as reusable contracts

**Negative / risks:**

- Market positioning becomes narrower: explicitly not a dbt Cloud alternative or observability platform
- Agents require orchestration: dbt-tools outputs are inputs to agent workflows, not agentic itself
- Cost data limited to artifacts: no warehouse API access for richer cost signals

**Mitigations:**

- Document explicitly in README and ADRs what dbt-tools does and doesn't do
- Link to complementary tools (dbt-mcp, dbt extension, external orchestration frameworks) for unmet needs
- Extend artifact-derived analysis where possible (bottleneck detection, adapter metrics, timeline)

## Alternatives considered

1. **Keep "agent-first" framing**: Rejected—undersells operator value and risks positioning as AI copilot
2. **Position as dbt Cloud alternative**: Rejected—incorrect, confuses users, unsustainable (no execution)
3. **Position as observability platform**: Rejected—no real-time monitoring, no alerting, scope creep
4. **Narrow to library-only**: Rejected—CLI and web are valuable entry points; library alone undersells
5. **Focus on AI agents only**: Rejected—deterministic analysis stands on its own for human operators

## References

- [ADR-0006: Artifact-first agent-first positioning](0006-artifact-first-agent-first-positioning-of-dbt-tools.md) — architectural strategy (no platforms, no LSP, offline-first)
- [ADR-0005: Field-level lineage via AST parsing](0005-field-level-lineage-inference-via-ast-parsing.md) — unique analysis capability
- [ADR-0007: Bottleneck detection via run_results search](0007-bottleneck-detection-via-run-results-search.md) — execution analysis
- [ADR-0030: Adapter response metrics](0030-adapter-response-metrics-in-analysis-snapshot-and-run-report.md) — performance intelligence
- **Code evidence:**
  - ExecutionAnalyzer: critical path, Gantt, bottleneck detection (`packages/dbt-tools/core/src/analysis/execution-analyzer.ts`)
  - ManifestGraph: dependency analysis, build order (`packages/dbt-tools/core/src/analysis/manifest-graph.ts`)
  - AdapterResponseMetrics: warehouse-agnostic cost/performance data (`packages/dbt-tools/core/src/analysis/adapter-response-metrics.ts`)
  - CLI: deterministic structured interface with field filtering, schema introspection (`packages/dbt-tools/cli/src/cli.ts`)
  - Web: investigative workspace for operators (`packages/dbt-tools/web/src/`)
