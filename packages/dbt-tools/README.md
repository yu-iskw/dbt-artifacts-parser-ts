# @dbt-tools

A suite of TypeScript tools for analyzing dbt artifacts, built on [`dbt-artifacts-parser`](../dbt-artifacts-parser/README.md).

---

## Packages

| Package                               | Description                                                     |
| ------------------------------------- | --------------------------------------------------------------- |
| [`@dbt-tools/core`](./core/README.md) | Core library — dependency graphs, execution analysis, utilities |
| [`@dbt-tools/cli`](./cli/README.md)   | CLI tool (`dbt-tools`) for artifact analysis                    |
| [`@dbt-tools/web`](./web/README.md)   | React web app for visual artifact analysis                      |

---

## Architecture

```mermaid
graph TD
  DAP[dbt-artifacts-parser]

  DAP -->|parsed artifact types| CORE[@dbt-tools/core]
  CORE -->|ManifestGraph\nExecutionAnalyzer\nDependencyService| CLI[@dbt-tools/cli\ndbt-tools binary]
  CORE -->|browser export| WEB[@dbt-tools/web\nReact app]
  DAP -->|direct parse calls| CLI
  DAP -->|direct parse calls| WEB
```

---

## When to Use Which Package

| I want to…                                                             | Use                                                         |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| Parse dbt JSON artifacts in TypeScript with type safety                | [`dbt-artifacts-parser`](../dbt-artifacts-parser/README.md) |
| Build a dependency graph or run execution analysis programmatically    | [`@dbt-tools/core`](./core/README.md)                       |
| Analyze artifacts from the command line or feed results to an AI agent | [`@dbt-tools/cli`](./cli/README.md)                         |
| Visually explore dependencies and execution timelines in a browser     | [`@dbt-tools/web`](./web/README.md)                         |

---

## Installation

```bash
# Core library
pnpm add @dbt-tools/core

# CLI tool (global)
pnpm add -g @dbt-tools/cli
```

The web app is not published to npm. Run it locally:

```bash
cd packages/dbt-tools/web
pnpm dev
```

---

## Relationship to dbt-artifacts-parser

`@dbt-tools/*` packages depend on `dbt-artifacts-parser` for all artifact parsing and type definitions. They do **not** replace it — they add a layer of analysis on top.

```mermaid
graph LR
  dbt["dbt run\n(generates artifacts)"]
  FS["./target/\nmanifest.json\nrun_results.json"]
  DAP[dbt-artifacts-parser\ntype-safe parsing]
  CORE[@dbt-tools/core\ngraph · analysis]
  CLI[@dbt-tools/cli]
  WEB[@dbt-tools/web]

  dbt --> FS
  FS --> DAP
  DAP --> CORE
  CORE --> CLI
  CORE --> WEB
```

---

## License

Apache License 2.0.
