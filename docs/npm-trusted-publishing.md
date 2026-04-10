# npm trusted publishing (GitHub Actions)

This repository publishes to the public npm registry from **GitHub Actions** using [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OpenID Connect), so CI does **not** need a long-lived `NPM_TOKEN` for the publish step.

Requirements from npm: **Node ≥ 22.14.0**, **npm CLI ≥ 11.5.1**, **GitHub-hosted runners**, and each published package’s [`repository`](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#repository) URL must match the GitHub repository used for the workflow.

## 1. Configure each package on npmjs.com (maintainer)

Releases use a **single** workflow: [`.github/workflows/publish-npm.yml`](../.github/workflows/publish-npm.yml) (job `publish_parser` then `publish_dbt_tools`).

For **each** published package, open **Package → Settings → Trusted publishing**, choose **GitHub Actions**, and set:

| npm package            | Workflow filename to register on npm |
| ---------------------- | ------------------------------------ |
| `dbt-artifacts-parser` | `publish-npm.yml`                    |
| `@dbt-tools/core`      | `publish-npm.yml`                    |
| `@dbt-tools/cli`       | `publish-npm.yml`                    |
| `@dbt-tools/web`       | `publish-npm.yml`                    |

- **Repository** must match this repo (e.g. `yu-iskw/dbt-artifacts-parser-ts`). The workflow filename is **case-sensitive** and must include `.yml`.
- **Each package can only have one trusted publisher at a time.** If you previously registered `publish-dbt-artifacts-parser.yml` or `publish-dbt-tools.yml`, update **every** package above to `publish-npm.yml` so OIDC matches the workflow that actually runs.

Optional after OIDC publishes succeed: **Package → Settings → Publishing access** → **Require two-factor authentication and disallow tokens** (OIDC continues to work).

## 2. Verify OIDC on the next publish

1. Run [`.github/workflows/publish-npm.yml`](../.github/workflows/publish-npm.yml) via **`workflow_dispatch`** or a **GitHub Release**.
2. In the job log, confirm publish uses **OIDC / trusted publishing** (not only a classic token). If you see **ENEEDAUTH**, re-check the workflow filename and repository on npmjs.com (npm does not validate until publish).

## 3. Remove obsolete CI secrets and npm tokens (after a green release)

1. **GitHub:** Remove the **`NPM_TOKEN`** repository secret if nothing else references it.
2. **npm:** [Revoke](https://docs.npmjs.com/revoking-access-tokens) automation tokens that existed only for CI publish.

Rollback: temporarily restore `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` on the publish step while keeping `id-token: write`, fix portal metadata, then remove the secret again.
