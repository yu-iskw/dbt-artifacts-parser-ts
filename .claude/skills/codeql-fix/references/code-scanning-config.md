# Code scanning config (template + renderer)

This skill ships a YAML template and a small shell renderer under the same directory as [`SKILL.md`](../SKILL.md).

- **Template:** [`assets/code-scanning-config.template.yml`](../assets/code-scanning-config.template.yml)
- **Renderer:** [`scripts/render-code-scanning-config.sh`](../scripts/render-code-scanning-config.sh)

Use the rendered file with `codeql database create --codescanning-config=<file>` when you need `paths-ignore` or other [code scanning configuration](https://aka.ms/code-scanning-docs/config-file) options beyond what this repository’s `pnpm codeql` scripts apply.
