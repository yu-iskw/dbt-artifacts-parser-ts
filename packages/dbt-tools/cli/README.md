# @dbt-tools/cli

Command-line interface for dbt artifact analysis.

## Installation

```bash
pnpm add -g @dbt-tools/cli
```

## Commands

### analyze

Analyze dbt manifest and provide summary statistics.

```bash
dbt-tools analyze path/to/manifest.json
dbt-tools analyze path/to/manifest.json --json
```

### graph

Export dependency graph in various formats.

```bash
dbt-tools graph path/to/manifest.json --format json
dbt-tools graph path/to/manifest.json --format dot --output graph.dot
dbt-tools graph path/to/manifest.json --format gexf --output graph.gexf
```

### run-report

Generate execution report from run_results.json.

```bash
dbt-tools run-report path/to/run_results.json
dbt-tools run-report path/to/run_results.json path/to/manifest.json --json
```

## Examples

```bash
# Basic analysis
dbt-tools analyze target/manifest.json

# Export graph as DOT format
dbt-tools graph target/manifest.json --format dot --output graph.dot

# Generate execution report with critical path
dbt-tools run-report target/run_results.json target/manifest.json
```
