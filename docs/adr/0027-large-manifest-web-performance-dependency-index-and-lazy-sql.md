# 27. Large-manifest web performance: direct dependency index and lazy SQL

Date: 2026-03-29

## Status

Accepted

## Context

The `@dbt-tools/web` workspace loads `manifest.json` and `run_results.json` in an analysis Web Worker, then builds an `AnalysisSnapshot` for React.

Two patterns prevented scaling to very large projects (many models, tests, and other nodes):

1. **Snapshot build:** `buildResourcesAndDependencyIndex` called `getUpstream` / `getDownstream` with no depth limit for every node, performing a full BFS over reachable nodes while only keeping eight preview neighbors. Cost grew far faster than \(O(V+E)\).

2. **Memory and `postMessage` cost:** Each `ResourceNode` carried `compiledCode` and `rawCode` for every resource, multiplying payload size when SQL is large.

## Decision

### Part A — Direct (1-hop) dependency index

- Build `dependencyIndex` previews with `getUpstream(id, 1)` and `getDownstream(id, 1)`.
- Set `upstreamCount` and `downstreamCount` to the **number of direct** upstream/downstream neighbors (not transitive closure).
- UI copy uses **“Direct upstream”** / **“Direct downstream”** where counts are shown.

Lineage exploration over multiple hops continues to work by walking successive 1-hop entries in `dependencyIndex` within capped depth (existing `lineageModel` behavior).

### Part B — Lazy SQL in the worker

- `ResourceNode` rows in the snapshot set `compiledCode` and `rawCode` to `null`.
- After a successful load, the worker retains the `ManifestGraph` and serves `get-resource-code` requests for a `uniqueId`, reading `compiled_code` / `raw_code` from graph node attributes.
- The asset SQL panel uses `useResourceCode` to fetch text asynchronously.

### Part C — Worker protocol v2

- Bump `ANALYSIS_WORKER_PROTOCOL_VERSION` to `2`.
- Add `search-resources` so the omnibox can scan resources off the main thread (same match rules as `matchesResource` in the web package).
- Add `get-resource-code` for lazy SQL.

### Part D — UI scalability

- Virtualize the asset explorer tree (`@tanstack/react-virtual`).
- Memoize filtered explorer resources in `AnalysisWorkspace`.
- Replace the inventory empty-state `<select>` over all resources with a debounced search backed by the worker.

## Consequences

- **Semantic change:** Summary counts are no longer transitive closure totals. Users who need global reachability metrics should rely on lineage depth controls or future lazy totals.
- **API consumers:** `@dbt-tools/core` `buildAnalysisSnapshotFromParsedArtifacts` now returns `{ analysis, timings, graph }` so callers that need the graph after build (e.g. the worker) can retain it without rebuilding.
- **Tests:** Core snapshot tests assert 1-hop depths and null bulk SQL; worker tests cover protocol v2 messages.

## Related

- [0002-use-graphology-for-graph-management.md](./0002-use-graphology-for-graph-management.md)
- [0021-strangler-style-decomposition-for-oversized-analysisworkspace-views.md](./0021-strangler-style-decomposition-for-oversized-analysisworkspace-views.md)
