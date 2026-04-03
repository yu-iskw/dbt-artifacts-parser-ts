# Repository license map

This monorepo contains **multiple licenses**. Use this file as the authoritative map of which paths fall under which terms. Automated tools (including GitHub’s license detection) may not reflect multiple licenses; rely on this map and the linked full texts.

| Scope                                                                                                             | License                                            | Full text                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/dbt-artifacts-parser/`](../packages/dbt-artifacts-parser/) (npm: `dbt-artifacts-parser`)               | **Apache-2.0**                                     | [Apache-2.0.txt](./Apache-2.0.txt) (canonical); same text ships as [`../packages/dbt-artifacts-parser/LICENSE`](../packages/dbt-artifacts-parser/LICENSE) in the npm package |
| [`packages/dbt-tools/`](../packages/dbt-tools/) (`@dbt-tools/core`, `@dbt-tools/cli`, `@dbt-tools/web`)           | **Source-available** (custom; not OSI open source) | [`../packages/dbt-tools/LICENSE`](../packages/dbt-tools/LICENSE)                                                                                                             |
| Shared repository infrastructure (e.g. root [`scripts/`](../scripts/), [`.github/`](../.github/), top-level docs) | **Not a single license**                           | Per-file headers and the licenses of the **packages** you build or publish apply to shipped artifacts. For anything unclear, contact the maintainer.                         |

For contribution terms, see [CONTRIBUTING.md](../CONTRIBUTING.md).
