# 35. dbt-tools operational intelligence positioning and category boundaries

Date: 2026-04-10

## Status

Accepted

Depends-on [6. Artifact-first agent-first positioning of dbt-tools](0006-artifact-first-agent-first-positioning-of-dbt-tools.md)

Supports [18. Hybrid dbt-first catalog and runs workspace for dbt-tools web](0018-hybrid-dbt-first-catalog-and-runs-workspace-for-dbt-tools-web.md)

## Context

dbt-tools needs a **stable, durable** product story that matches what the software actually does: deterministic analysis of dbt artifacts (`manifest.json`, `run_results.json`, `catalog.json`, and related files) for humans and for automation—including coding agents and CI—without implying capabilities we do not provide.

Earlier positioning (see ADR-0006) emphasized **artifact-only** operation and **agent-friendly** outputs. That remains technically correct, but the label “agent-first” can be misread as “AI is the product.” We need explicit **external** and **internal** framing plus **non-goals** so readers do not map dbt-tools onto adjacent categories: hosted dbt platforms, observability SaaS, or chat-first copilots.

## Decision

### Product thesis

**dbt-tools turns dbt artifacts into deterministic operational intelligence for humans and agents.**

- **External positioning:** dbt-tools is a **dbt operational intelligence layer**—structured answers about dependencies, execution, inventory, and readiness derived from artifacts.
- **Internal / architecture positioning:** dbt-tools is a **composable analysis substrate for dbt artifacts** that serves both operators and agents.

### Package roles

| Package           | Role                                                                                                                                                                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@dbt-tools/core` | Reusable **analysis engine**: graph construction, execution analysis, snapshots, exports, and shared logic for CLI and web. Intended as a **substrate** other systems can build on—not a private implementation detail.                                                                   |
| `@dbt-tools/cli`  | **Structured interface** for operators, scripts, CI, and coding agents: a task-oriented command hierarchy, machine-readable JSON, dual-surface discovery via help and `describe schema`, `--fields` to bound payloads, validated inputs, and stable error codes.                          |
| `@dbt-tools/web`  | **Deterministic investigation UI**: dependency and lineage views, execution timelines, inventory, health-oriented summaries—**valuable without an LLM**. Remote artifact sources (S3/GCS) are **optional, configured infrastructure**, not a multi-tenant SaaS assumption (see ADR-0029). |

### Messaging pillars (use consistently in docs)

1. **Structured artifact intelligence** — From manifests and run results: dependency intelligence, execution intelligence (critical path, bottlenecks, timelines), inventory/search/discovery, graph exports and focused subgraphs, readiness/freshness checks.
2. **Human + agent interface** — Useful interactively for operators and programmatically for automation, CI, agent skills, and multi-tool workflows.
3. **Actionable without AI** — The web app should answer questions such as what failed, what is slow, what is on the critical path, what depends on a node, and what to inspect next, using artifact-driven views alone.
4. **Local-first / controlled environments** — Default paths assume local `target/` artifacts; remote access is explicit configuration in trusted environments.

### CLI interaction model

`@dbt-tools/cli` uses a **task-oriented hierarchy** rather than a flat verb list.

- Top-level families should communicate user intent first: inspect, find, trace, export, check, and describe.
- CLI discovery is **dual-surface**: people should be able to orient through `--help`, while agents and automation can query `describe schema` for the same command tree.
- Command-family structure is a **forward-growth mechanism**. New capabilities should prefer joining an existing family before introducing a new top-level family.
- Human guessability is prioritized, but never by weakening machine-readable discovery or structured outputs.

### Explicit non-goals (category boundaries)

1. **Not a dbt Cloud (or platform) clone** — dbt-tools does not provide hosted execution, job scheduling, orchestration as a product, IDE, or a full governance suite. It does not replace a dbt Cloud–style platform.
2. **Not an observability SaaS clone** — dbt-tools is not primarily alerting, anomaly detection, incident management, or a generic “data observability” product category. Execution and health views are **artifact-grounded investigation**, not a monitoring product pitch.
3. **Not “AI for dbt” as the headline** — Agents and structured CLI outputs matter, but the core value is **deterministic operational intelligence** from artifacts; AI is **additive**, not foundational to the value proposition.
4. **Web app is not a chat/copilot surface** — The browser experience is analysis and navigation over artifacts, not a conversational assistant as the primary UX.

ADR-0006 remains authoritative for **artifact-only** scope, **offline/CI** use, and **non-overlap** with capabilities that belong in dbt-mcp or the dbt VS Code extension (SQL execution, Semantic Layer, LSP live editing, etc.). This ADR adds **go-to-market and architecture language** and **category boundaries** without changing those technical decisions.

## Consequences

**Positive:**

- One place to point contributors and readers for “what dbt-tools is” vs “what it is not.”
- Aligns READMEs and user guides with package boundaries (core / CLI / web).
- Gives the CLI a stable, extensible interaction model that is easier to teach and easier for agents to discover.
- Reduces mistaken comparisons to Cloud, observability vendors, or chat-only tools.

**Negative / risks:**

- Docs require occasional refresh when capabilities grow; positioning language should stay tied to shipped behavior.
- Historical ADRs (e.g. UX benchmarks in ADR-0018) must be read with this ADR so “benchmark product” is not confused with “category clone.”
- CLI taxonomy changes are breaking product-surface changes and should be treated as deliberate decisions, not opportunistic naming churn.

## Alternatives considered

- **Replace ADR-0006 entirely** — Rejected: would obscure history and stable links; amendment + this ADR is clearer.
- **Single slogan only (“operational intelligence”)** — Insufficient for internal architecture; “composable analysis substrate” captures reuse of `@dbt-tools/core` and integration patterns.

## References

- [ADR-0006](0006-artifact-first-agent-first-positioning-of-dbt-tools.md) — artifact-only operation, differentiation from official tools
- [ADR-0018](0018-hybrid-dbt-first-catalog-and-runs-workspace-for-dbt-tools-web.md) — web information architecture
- [ADR-0029](0029-remote-object-storage-artifact-sources-and-auto-reload.md) — remote artifact sources as configured infrastructure
