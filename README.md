# dbt-artifacts-parser-ts

A TypeScript monorepo for **`dbt-artifacts-parser`**: typed parsing of [dbt](https://www.getdbt.com/) JSON artifacts with automatic version detection.

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

## Quick Start

```bash
npm install dbt-artifacts-parser
```

For API details and examples, see [packages/dbt-artifacts-parser/README.md](./packages/dbt-artifacts-parser/README.md).

---

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to build, test, and contribute to this monorepo.

---

## License

This monorepo uses **two different licenses** for different parts of the tree. The **authoritative path map** is **[`LICENSES/README.md`](./LICENSES/README.md)**. The file at the repository root named [`LICENSE`](./LICENSE) is a **short manifest** only (not the Apache legal text). GitHub and other tools may not show multiple licenses correctly; use the manifest and the links below.

| Area                                                                                               | License                                              | Full text                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/dbt-artifacts-parser/`](./packages/dbt-artifacts-parser/) (npm: `dbt-artifacts-parser`) | **Apache-2.0**                                       | [`LICENSES/Apache-2.0.txt`](./LICENSES/Apache-2.0.txt) (canonical); also [`packages/dbt-artifacts-parser/LICENSE`](./packages/dbt-artifacts-parser/LICENSE) (npm tarball) |
| [`packages/dbt-tools/`](./packages/dbt-tools/)                                                     | **Source-available** (custom; not OSI “open source”) | [`packages/dbt-tools/LICENSE`](./packages/dbt-tools/LICENSE)                                                                                                              |

Published npm tarballs ship a `LICENSE` file and `package.json` metadata appropriate to each package. For permissions beyond what the **source-available** license in [`packages/dbt-tools/LICENSE`](./packages/dbt-tools/LICENSE) grants, contact the maintainer via the repository.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how contributions are licensed per package.
