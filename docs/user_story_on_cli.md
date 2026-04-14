# User Stories for an Agent-First dbt CLI Experience

This document defines the intended user experience for the dbt CLI in an agent-first workflow.
It is intentionally narrative and outcome-focused. It does not prescribe command syntax, flags,
or implementation details for the current CLI.

## Purpose

The CLI should help people and AI agents investigate a dbt run quickly and reliably by turning
artifact data into consistent, machine-readable facts. The highest-value experience is:

1. Incident triage first
2. Performance tuning second
3. Lineage and impact analysis third
4. Audit and compliance context fourth

## Scope and Boundaries

### In scope

- A single pinned dbt run represented by one resolved artifact bundle
- Deterministic extraction and wrangling of dbt artifact information
- Stable identifiers and predictable output shape suitable for automation

### Out of scope

- Command tutorials or operator recipes
- Final command/flag contracts for an immature CLI surface
- Native warehouse telemetry retrieval in the CLI itself
- Native multi-run comparison in the CLI itself

The CLI is the artifact intelligence layer. AI agents may combine its outputs with other tools.

## Primary Users and Contexts

### Personas

- Analytics engineers investigating failures or regressions
- Platform engineers maintaining CI and runtime reliability
- AI agents orchestrating repeatable investigation workflows

### Execution contexts

- Local laptop workflows
- CI workflows
- Cloud workstation or devcontainer workflows

The same mental model should apply across all contexts. Only artifact resolution paths should vary.

## Foundational Story: Pinned-Run Contract

As an engineer or agent, I need every answer to be anchored to one explicit run so that
investigation results are reproducible and auditable.

### Expected experience

- Each investigation starts from a clearly resolved artifact bundle
- The output conveys run provenance clearly
- Incomplete or invalid bundles fail loudly and actionably
- Optional artifacts can be absent without corrupting core analysis

### Important boundary

Multi-run comparison is not a first-class CLI concern in this story. If comparison is needed,
agents orchestrate multiple single-run extractions and perform the diff externally.

## Agent Ergonomics Principles

As an AI agent, I need output that is deterministic, bounded, and composable so that I can reason
reliably and avoid noisy or oversized prompts.

### Requirements

- Machine-readable output is the primary experience
- Default responses are intentionally small
- Rich detail is available only on explicit request
- Identity and correlation fields are stable across related outputs
- Error responses are predictable enough for automated handling

## Epic 1: Failure-First Triage

As an engineer, I want to immediately see failed dbt resources so that I can restore pipeline
health quickly.

### Triage user stories

- As a user, I can get a concise queue of failed resources from a pinned run
- As an agent, I can prioritize likely fix order without scanning the entire manifest
- As a user, I can choose to include warning resources when I explicitly widen scope

### Triage UX intent

Warnings are opt-in in the primary triage flow to keep default signal sharp.

## Epic 2: Resource Dossier

As an engineer, I want one conceptual "dossier" view for a resource so that I can understand
execution behavior, model definition context, and warehouse-facing identity in one investigation.

### Resource dossier user stories

- As a user, I can begin with a minimal summary for one resource
- As an agent, I can request expanded sections only when needed
- As a user, I can stay within one investigation narrative instead of jumping between disconnected views

## Epic 3: Dependency Exploration

As an engineer, I need upstream and downstream context for a resource so that I can assess blast
radius and root-cause direction before making changes.

### Dependency exploration user stories

- As a user, I can inspect upstream dependencies for root-cause analysis
- As a user, I can inspect downstream dependents for impact analysis
- As an agent, I can request bounded graph slices that avoid unbounded payload growth

## Epic 4: Within-Run Performance Ranking

As a platform or analytics engineer, I want top-N slow resources for one pinned run so that I can
target tuning work where it matters most.

### Performance ranking user stories

- As a user, I can rank resources by runtime for the pinned run
- As an agent, I can correlate slow resources with failure or dependency context from the same run
- As a user, I can create repeatable optimization workflows without needing command-specific knowledge

## Epic 5: Warehouse Cost Signals via Agent Composition

As an engineer, I want top-N resources by slot milliseconds and scanned bytes so that I can reduce
cost and runtime risk without overloading the CLI boundary.

### Warehouse composition user stories

- As an agent, I can use CLI outputs as stable dbt identity inputs for external warehouse tooling
- As an agent, I can use best-effort execution correlation handles when available
- As a user, I can receive merged cost insights while preserving the CLI's artifact-first role

### Warehouse composition UX intent

The CLI should not become a BigQuery client in this phase. It should provide dependable artifact
facts that external tools can join with warehouse telemetry.

## Epic 6: Bottleneck Thinking as Three Distinct Questions

As an engineer, I want to find bottlenecks from graph-theory perspectives so that I can prioritize
the right kind of intervention.

### Lens A: Structural chokepoints

Which nodes are central chokepoints in the DAG independent of one run's timing?

### Lens B: Runtime-weighted critical path

Which paths dominate elapsed time in the pinned run?

### Lens C: Frequency and blast-radius importance

Which nodes create the broadest downstream disruption when they fail?

### Bottleneck analysis UX intent

These are three different user questions and should remain explicit in story framing.

## Cross-Cutting Quality Bars

- Stable resource identity across all outputs
- Bounded defaults with explicit expansion behavior
- Clear provenance for every run-scoped answer
- Safe behavior with missing optional artifacts
- Predictable automation-friendly error semantics

## Composition Model

```mermaid
flowchart LR
  pinnedRun[PinnedDbtArtifactBundle]
  cli[CliArtifactWrangling]
  agent[AgentOrchestration]
  bqTooling[BigQueryTooling]

  pinnedRun --> cli
  cli --> agent
  agent --> bqTooling
  bqTooling --> agent
```

## Relationship to Other Documentation

This user-story document defines outcomes and experience principles. Operational details can evolve
as the CLI matures.

For positioning context, see:
[docs/adr/0035-dbt-tools-operational-intelligence-and-positioning-boundaries.md](./adr/0035-dbt-tools-operational-intelligence-and-positioning-boundaries.md).
