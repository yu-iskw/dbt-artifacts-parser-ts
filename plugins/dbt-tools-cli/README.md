# dbt-tools-cli (agent plugin)

First-party plugin wrapping the **[`@dbt-tools/cli`](../../packages/dbt-tools/cli/README.md)** **structured interface** (JSON, `schema`, `status`) so coding agents and skills can orchestrate artifact analysis alongside other tools. Skills live under [`skills/`](skills/).

| Skill                                                                  | Purpose                                                                                             |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`dbt-artifacts-status`](skills/dbt-artifacts-status/SKILL.md)         | Run `dbt-tools status` first; interpret `readiness` before other CLI commands.                      |
| [`status`](skills/status/SKILL.md)                                     | Check artifact presence, freshness, and readiness with `dbt-tools status`.                          |
| [`discover-search`](skills/discover-search/SKILL.md)                   | Find dbt resources by name, type, tag, or approximate wording; resolve `unique_id` for downstream commands. |
| [`deps`](skills/deps/SKILL.md)                                         | Trace upstream and downstream dependencies for a dbt resource with `dbt-tools deps`.               |
| [`explain-impact`](skills/explain-impact/SKILL.md)                     | Explain a resource and reason about change impact using `dbt-tools explain` and `dbt-tools impact`. |

See [plugins/README.md](../README.md) for marketplace layout and discovery. For verification, CI commands, and per-engine manifest maintenance, see [plugins/CONTRIBUTING.md](../CONTRIBUTING.md).
