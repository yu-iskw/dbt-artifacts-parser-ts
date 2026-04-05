# dbt-artifacts-parser-ts

[![Test](https://github.com/yu-iskw/dbt-artifacts-parser-ts/actions/workflows/test.yml/badge.svg)](https://github.com/yu-iskw/dbt-artifacts-parser-ts/actions/workflows/test.yml)
[![CodeQL](https://github.com/yu-iskw/dbt-artifacts-parser-ts/actions/workflows/codeql.yml/badge.svg)](https://github.com/yu-iskw/dbt-artifacts-parser-ts/actions/workflows/codeql.yml)
[![Supply chain checks](https://github.com/yu-iskw/dbt-artifacts-parser-ts/actions/workflows/supply-chain-checks.yml/badge.svg)](https://github.com/yu-iskw/dbt-artifacts-parser-ts/actions/workflows/supply-chain-checks.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/yu-iskw/dbt-artifacts-parser-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/yu-iskw/dbt-artifacts-parser-ts)
[![npm dbt-artifacts-parser](https://img.shields.io/npm/v/dbt-artifacts-parser)](https://www.npmjs.com/package/dbt-artifacts-parser)
[![npm @dbt-tools/cli](https://img.shields.io/npm/v/%40dbt-tools%2Fcli)](https://www.npmjs.com/package/@dbt-tools/cli)
[![npm @dbt-tools/web](https://img.shields.io/npm/v/%40dbt-tools%2Fweb)](https://www.npmjs.com/package/@dbt-tools/web)

> Security signals shown here are evidence of current release and scanning workflows, not proof of absence of defects or malicious behavior. npm releases are configured for provenance via GitHub Actions OIDC trusted publishing, repository code is continuously analyzed, and dependency changes are checked before merge.

A TypeScript monorepo for parsing and analyzing [dbt](https://www.getdbt.com/) artifacts.

This repo contains two distinct but related ecosystems:

| Ecosystem                                                  | Description                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`dbt-artifacts-parser`](./packages/dbt-artifacts-parser/) | Standalone parsing library — type definitions and auto-version-detection for dbt JSON artifacts |
| [`@dbt-tools/*`](./packages/dbt-tools/)                    | Analysis tools suite (CLI, core library, web app) built on top of the parser                    |

## Packages

### dbt-artifacts-parser

> `packages/dbt-artifacts-parser/` · npm: `dbt-artifacts-parser`

A standalone TypeScript library for parsing dbt artifact files with full type safety and automatic version detection. Use this if you only need to read and type-check dbt JSON artifacts.

Supported artifacts:

| Artifact           | Versions |
| ------------------ | -------- |
| `manifest.json`    | v1–v12   |
| `catalog.json`     | v1       |
| `run_results.json` | v1–v6    |
| `sources.json`     | v1–v3    |

[Full documentation →](./packages/dbt-artifacts-parser/README.md)

---

### @dbt-tools

> `packages/dbt-tools/` · npm scope: `@dbt-tools`

A suite of analysis tools for dbt artifacts. Built on `dbt-artifacts-parser`.

| Package                                                  | Description                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`@dbt-tools/core`](./packages/dbt-tools/core/README.md) | Core library — dependency graphs, execution analysis, formatting                   |
| [`@dbt-tools/cli`](./packages/dbt-tools/cli/README.md)   | CLI tool (`dbt-tools`) for artifact analysis, AI-agent-friendly                    |
| [`@dbt-tools/web`](./packages/dbt-tools/web/README.md)   | React web app for visual artifact analysis (local target, upload, optional S3/GCS) |

[Suite overview →](./packages/dbt-tools/README.md)

---

## Quick Start

```bash
# Parse dbt artifacts in your own TypeScript project
npm install dbt-artifacts-parser

# Use the CLI to analyze artifacts
npm install -g @dbt-tools/cli
dbt-tools summary          # requires ./target/manifest.json
dbt-tools run-report       # requires ./target/run_results.json

# Visual analyzer in the browser (published server binary)
npm install -g @dbt-tools/web
dbt-tools-web --target ./target   # or: npx @dbt-tools/web --target ./target
```

See [`packages/dbt-tools/web/README.md`](./packages/dbt-tools/web/README.md) for configuration (`DBT_TOOLS_REMOTE_SOURCE`, debugging, Docker pointers).

---

## Release provenance (npm)

Public npm packages published from this repository are intended to use npm trusted publishing from GitHub Actions with OIDC and provenance enabled. This helps consumers trace a published package back to this repository and workflow run, but it does not prove that software is defect-free or non-malicious on its own.

See [docs/security-signals.md](./docs/security-signals.md) for the security signal model, workflow coverage, and manual setup steps.

---

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to build, test, and contribute to this monorepo.

---

## License

This monorepo uses **two different licenses** for different parts of the tree. The **authoritative path map** is **[`LICENSES/README.md`](./LICENSES/README.md)**. The file at the repository root named [`LICENSE`](./LICENSE) is a **short manifest** only (not the Apache legal text). GitHub and other tools may not show multiple licenses correctly; use the manifest and the links below.

| Area                                                                                                   | License                                              | Full text                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/dbt-artifacts-parser/`](./packages/dbt-artifacts-parser/) (npm: `dbt-artifacts-parser`)     | **Apache-2.0**                                       | [`LICENSES/Apache-2.0.txt`](./LICENSES/Apache-2.0.txt) (canonical); also [`packages/dbt-artifacts-parser/LICENSE`](./packages/dbt-artifacts-parser/LICENSE) (npm tarball) |
| [`packages/dbt-tools/`](./packages/dbt-tools/) (`@dbt-tools/core`, `@dbt-tools/cli`, `@dbt-tools/web`) | **Source-available** (custom; not OSI “open source”) | [`packages/dbt-tools/LICENSE`](./packages/dbt-tools/LICENSE)                                                                                                              |

Published npm tarballs ship a `LICENSE` file and `package.json` metadata appropriate to each package. For permissions beyond what the dbt-tools license grants, contact the maintainer via the repository.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how contributions are licensed per package.
