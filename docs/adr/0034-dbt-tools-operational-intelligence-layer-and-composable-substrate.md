# 34. dbt-tools positioning as an operational intelligence layer and composable substrate

Date: 2026-04-09

## Status

Accepted

Depends-on [6. Artifact-first and agent-compatible positioning of dbt-tools](0006-artifact-first-agent-first-positioning-of-dbt-tools.md)

## Context

The project needs a durable category definition that is precise about what dbt-tools is and is not.

The prior language over-indexed on "agent-first" messaging in places and could be read as either:

- a replacement for full dbt execution/orchestration platforms, or
- an observability/alerting SaaS clone, or
- a copilot/chat product where AI is the primary value.

Those interpretations do not match the current package capabilities or product boundaries.

## Decision

We standardize positioning as follows:

### External positioning

`dbt-tools` is **a dbt operational intelligence layer**.

Canonical thesis sentence:

> dbt-tools turns dbt artifacts into deterministic operational intelligence for humans and agents.

### Internal architecture positioning

`@dbt-tools/*` is **a composable analysis substrate for dbt artifacts that serves both operators and agents**.

### Package role boundaries

1. **`@dbt-tools/core`** is the reusable analysis engine/substrate.
   - It converts artifacts into dependency intelligence, execution intelligence, and inventory/search primitives.
   - It is a first-class integration surface, not only an internal implementation detail.
2. **`@dbt-tools/cli`** is the structured interface for operators, scripts, CI, and agent orchestration.
   - Primary contract: stable JSON output, schema introspection, and field filtering for bounded context transfer.
3. **`@dbt-tools/web`** is a deterministic investigation UI.
   - It is actionable without AI and focused on artifact-driven investigation (failures, slow paths, critical path, blast radius, next inspection step).

### Explicit non-goals for category clarity

1. **Not a dbt Cloud replacement.**
   - No positioning around hosted execution, orchestration, IDE/LSP replacement, governance suite, or job scheduler.
2. **Not an observability SaaS clone.**
   - Alerting/anomaly/incident workflows are not the primary category definition.
3. **Not AI-only value.**
   - AI/agents are additive interfaces over deterministic artifact analysis, not the product foundation.

### Environment model

dbt-tools remains local-first and controlled-environment friendly:

- Works with local artifacts by default.
- Supports remote object storage only via explicitly configured infrastructure.
- Avoids SaaS assumptions as a requirement for core value.

## Alternatives considered

1. **Platform-replacement positioning**
   - Rejected: encourages feature expectations outside artifact-analysis scope.
2. **Observability-first positioning**
   - Rejected: narrows product identity to monitoring language and underrepresents graph/execution/inventory investigation.
3. **AI-copilot-first positioning**
   - Rejected: makes product value appear contingent on LLM interfaces despite deterministic, non-AI capabilities.
4. **Keep prior mixed messaging**
   - Rejected: leaves avoidable ambiguity across package docs and ADRs.

## Consequences

### Positive

- Clear, durable category language across core/CLI/web docs.
- Better expectation-setting for operators, automation engineers, and agent workflows.
- Preserves local-first adoption in controlled environments.

### Trade-offs

- Requires stricter language discipline in README and user-guide updates.
- Some older references that centered "agent-first" wording need ongoing cleanup when touched.

## Implementation notes

- README and user guide updates should consistently use `dbt-tools` naming.
- Outward docs should prefer "dbt operational intelligence layer".
- ADRs and architecture docs should prefer "composable analysis substrate" where role clarity matters.
