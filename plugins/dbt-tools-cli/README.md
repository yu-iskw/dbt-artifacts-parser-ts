# dbt-tools-cli (agent plugin)

First-party plugin wrapping the **[`@dbt-tools/cli`](../../packages/dbt-tools/cli/README.md)** **structured interface** (JSON, `schema`, `status`) so coding agents and skills can orchestrate artifact analysis alongside other tools. Skills live under [`skills/`](skills/).

| Skill                                                          | Purpose                                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`dbt-artifacts-status`](skills/dbt-artifacts-status/SKILL.md) | Run `dbt-tools status` first; interpret `readiness` before other CLI commands.              |
| [`status`](skills/status/SKILL.md)                             | Check artifact readiness/freshness when users ask whether targets are analyzable.           |
| [`discover-search`](skills/discover-search/SKILL.md)           | Resolve dbt resources and candidate `unique_id` values from names, tags, and fuzzy wording. |
| [`deps`](skills/deps/SKILL.md)                                 | Traverse upstream/downstream dependencies from a known `unique_id`.                         |
| [`explain-impact`](skills/explain-impact/SKILL.md)             | Explain resource behavior and summarize likely downstream impact.                           |

See [plugins/README.md](../README.md) for marketplace layout and discovery. For verification, CI commands, and per-engine manifest maintenance, see [plugins/CONTRIBUTING.md](../CONTRIBUTING.md).
