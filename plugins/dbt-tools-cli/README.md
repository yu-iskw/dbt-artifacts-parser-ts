# dbt-tools-cli (agent plugin)

First-party plugin wrapping the **[`@dbt-tools/cli`](../../packages/dbt-tools/cli/README.md)** **structured interface** (JSON, `schema`, `status`) so coding agents and skills can orchestrate artifact analysis alongside other tools. Skills live under [`skills/`](skills/).

| Skill                                                          | Purpose                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`dbt-artifacts-status`](skills/dbt-artifacts-status/SKILL.md) | Run `dbt-tools status` first; interpret `readiness` before other CLI commands. |
| [`status`](skills/status/SKILL.md) | Check artifact readiness and freshness with `dbt-tools status`; interpret `readiness` and `age_seconds` to decide whether artifacts are present and current. |
| [`discover-search`](skills/discover-search/SKILL.md) | Find dbt resources by name, type, tag, package, or approximate wording using `dbt-tools discover` / `dbt-tools search`; resolve `unique_id` values for follow-up commands. |
| [`deps`](skills/deps/SKILL.md) | Investigate upstream and downstream dependencies for a dbt resource with `dbt-tools deps`; supports depth-limited, flat/tree, and build-order patterns. |
| [`explain-impact`](skills/explain-impact/SKILL.md) | Explain a resource and assess its downstream blast radius using `dbt-tools explain` and `dbt-tools impact`; includes availability check and fallback patterns. |

See [plugins/README.md](../README.md) for marketplace layout and discovery. For verification, CI commands, and per-engine manifest maintenance, see [plugins/CONTRIBUTING.md](../CONTRIBUTING.md).
