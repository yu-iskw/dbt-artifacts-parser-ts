# dbt-tools-cli (agent plugin)

First-party plugin for **[`@dbt-tools/cli`](../../packages/dbt-tools/cli/README.md)** workflows. Skills live under [`skills/`](skills/).

| Skill                                                          | Purpose                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`dbt-artifacts-status`](skills/dbt-artifacts-status/SKILL.md) | Run `dbt-tools status` first; interpret `readiness` before other CLI commands. |

See [plugins/README.md](../README.md) for marketplace layout and discovery. For verification, CI commands, and per-engine manifest maintenance, see [plugins/CONTRIBUTING.md](../CONTRIBUTING.md).
