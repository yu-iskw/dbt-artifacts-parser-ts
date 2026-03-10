# @dbt-tools/core

Core library for dbt artifact graph management and analysis.

## Features

- **ManifestGraph**: Build and manage dependency graphs from dbt manifests
- **ExecutionAnalyzer**: Analyze execution results and calculate critical paths
- **High Performance**: Optimized for large manifests with 100k+ nodes

## Installation

```bash
pnpm add @dbt-tools/core
```

## Usage

```typescript
import { parseManifest } from "dbt-artifacts-parser/manifest";
import { ManifestGraph } from "@dbt-tools/core";

const manifest = parseManifest(manifestJson);
const graph = new ManifestGraph(manifest);

// Get summary statistics
const summary = graph.getSummary();
console.log(`Total nodes: ${summary.total_nodes}`);
console.log(`Has cycles: ${summary.has_cycles}`);

// Get upstream dependencies
const upstream = graph.getUpstream("model.my_project.my_model");

// Get downstream dependents
const downstream = graph.getDownstream("model.my_project.my_model");
```

## API

### ManifestGraph

- `getGraph()`: Get the underlying graphology graph
- `getSummary()`: Get summary statistics
- `getUpstream(nodeId)`: Get all upstream dependencies
- `getDownstream(nodeId)`: Get all downstream dependents

### ExecutionAnalyzer

- `getSummary()`: Get execution summary with critical path
- `getNodeExecutions()`: Get execution details for each node
- `getGanttData()`: Get Gantt chart data for visualization
