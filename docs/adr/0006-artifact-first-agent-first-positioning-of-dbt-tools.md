# 6. Artifact-first and agent-compatible positioning of dbt-tools

Date: 2026-03-13

## Status

Superseded by [34. dbt-tools positioning as an operational intelligence layer and composable substrate](0034-dbt-tools-operational-intelligence-layer-and-composable-substrate.md)

## Context

This ADR captured the first explicit positioning pass for dbt-tools around artifact-only analysis and agent compatibility.

## Decision

The original decision established that dbt-tools should:

1. Operate on dbt artifacts (`manifest.json`, `run_results.json`, `catalog.json`) rather than live execution systems.
2. Expose structured interfaces suitable for deterministic automation.
3. Keep scope bounded to artifact-derived analysis.

## Consequences

The decision shaped package boundaries and paved the way for the current positioning model in ADR-0034.

## Notes

Use ADR-0034 as the authoritative messaging and product-boundary record for external and internal positioning.
