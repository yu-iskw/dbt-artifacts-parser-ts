# 34. Position dot-tools as a deterministic operational intelligence layer for dbt artifacts

Date: 2026-04-09

## Status

Accepted

Depends-on [6. Artifact-first and agent-compatible positioning of dbt-tools (superseded in part)](0006-artifact-first-agent-first-positioning-of-dbt-tools.md)

## Context

Current repository messaging often describes dot-tools as “CLI + web + core,” which is implementation-accurate but strategically incomplete. It underspecifies:

- the operator outcome (actionable investigation, not only visualization),
- the automation outcome (stable structured contract, not chat UX), and
- the architectural center (`@dbt-tools/core` as reusable substrate, not only package internals).

The codebase already provides deterministic artifact analysis primitives and interfaces:

- graph/dependency/execution analysis from dbt artifacts,
- machine-readable CLI behavior in non-TTY contexts,
- schema introspection and field filtering for low-noise consumers,
- web workflows for timeline, lineage, inventory, and readiness checks,
- local-first operation with optional remote artifact source ingestion.

Without an explicit product thesis, docs drift toward one of two failure modes: (1) “just another DAG viewer,” or (2) “AI copilot” framing that overstates current capabilities and obscures deterministic value.

## Decision

Adopt the following canonical framing across repository documentation and future ADRs:

1. **External positioning:** dot-tools is a **dbt operational intelligence layer**.
2. **Internal architecture framing:** dot-tools is a **composable analysis substrate for dbt artifacts serving operators and agents**.
3. **Primary artifact:** structured deterministic intelligence (JSON objects, graph exports, typed analysis results), not generated prose.
4. **AI stance:** AI is optional and downstream; value must remain actionable without AI.
5. **Package roles:**
   - `@dbt-tools/core`: reusable analysis substrate and primitives,
   - `@dbt-tools/cli`: stable structured contract for automation/agents,
   - `@dbt-tools/web`: operator investigation workspace for action-oriented diagnostics.

## Non-goals

- Build a hosted dbt execution platform.
- Replicate dbt Cloud functionality end-to-end.
- Replicate Elementary functionality end-to-end.
- Position dot-tools as a chat-first dbt copilot.
- Reduce the product proposition to a DAG viewer.

## Why deterministic, non-AI workflows come first

- **Reproducibility:** operators and CI systems need stable results from fixed artifacts.
- **Auditability:** deterministic JSON outputs and typed interfaces are inspectable and testable.
- **Controlled environments:** many teams operate without broad external API access or model dependencies.
- **Composability:** stable structured outputs can be consumed by scripts, CI, and future agent skills uniformly.

AI can summarize or prioritize findings, but it should consume deterministic outputs rather than replace them.

## Why agent compatibility is architectural (but not the whole product)

Agent compatibility is achieved through interface properties (schema discovery, stable error codes, field filters, machine-readable output modes), not through a chat frontend. This improves reliability for automation while preserving direct value for human operators in the web UI and CLI text mode.

## Alternatives considered

### 1) Keep package-by-package implementation messaging only

Rejected. Accurate but too low-level; it does not communicate why the pieces exist or how they compose into operator + automation value.

### 2) Reposition as AI copilot first

Rejected. Not supported by current architecture as primary value and would de-emphasize deterministic strengths.

### 3) Reposition as generic observability SaaS

Rejected. Over-broad relative to current capabilities and would imply hosted monitoring/alerting commitments not present in this repository.

### 4) Frame mainly against competitor substitutes

Rejected as primary framing. Distinctions matter, but constant comparator-led messaging creates unnecessary coupling to external products.

## Consequences

### Positive

- Clear, technically defensible product thesis across docs.
- Better separation of package responsibilities and user expectations.
- Stronger foundation for future composition with adjacent data (for example warehouse metadata, CI context, or job telemetry) without changing the core thesis.

### Negative

- Existing docs must be kept aligned to avoid regressions into tool-centric or comparator-centric language.
- The phrase “operational intelligence” may be interpreted broadly; documentation must continue to tie claims to concrete implemented capabilities.

### Mitigations

- Require concrete capability references in docs (commands/views/interfaces).
- Keep explicit non-goals in strategy-facing docs and ADRs.
- Prefer deterministic-interface wording in CLI/core documentation.
