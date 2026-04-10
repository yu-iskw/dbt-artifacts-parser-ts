# dbt-tools-cli (agent plugin)

First-party plugin wrapping the **[`@dbt-tools/cli`](../../packages/dbt-tools/cli/README.md)** **structured interface** (JSON, `schema`, `status`) so coding agents and skills can orchestrate artifact analysis alongside other tools. Skills live under [`skills/`](skills/).

| Skill                                                          | Purpose                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`dbt-artifacts-status`](skills/dbt-artifacts-status/SKILL.md) | Run `dbt-tools status` first; interpret `readiness` before other CLI commands. |

See [plugins/README.md](../README.md) for marketplace layout and discovery. For verification, CI commands, and per-engine manifest maintenance, see [plugins/CONTRIBUTING.md](../CONTRIBUTING.md).
