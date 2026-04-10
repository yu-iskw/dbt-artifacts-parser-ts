# dbt-tools-cli (agent plugin)

First-party plugin for **[`@dbt-tools/cli`](../../packages/dbt-tools/cli/README.md)** workflows. Skills live under [`skills/`](skills/).

| Skill                                                | Purpose                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`hello`](skills/hello/SKILL.md)                     | Smoke-test that the plugin loads (minimal instructions).                       |
| [`artifact-status`](skills/artifact-status/SKILL.md) | Run `dbt-tools status` first; interpret `readiness` before other CLI commands. |

See [plugins/README.md](../README.md) for marketplace layout, verification, and per-engine manifests.
