# Security signals for dbt-artifacts-parser-ts

This document describes the repository’s **trust signals** for released npm packages and source code scanning. These signals help consumers evaluate traceability and security process maturity. They are not proof of total safety.

## What was implemented

- **npm trusted publishing + provenance** in release workflows for:
  - `dbt-artifacts-parser`
  - `@dbt-tools/core`
  - `@dbt-tools/cli`
  - `@dbt-tools/web`
- **CodeQL** workflow for JavaScript/TypeScript on `main`, pull requests to `main`, and weekly schedule.
- **Dependency Review** PR gate to block introduction of known vulnerable dependencies above configured severity.
- **OSV-Scanner** scheduled/full scans over the monorepo dependency graph (`pnpm-lock.yaml`) with SARIF upload.
- **OpenSSF Scorecard** workflow and public Scorecard badge.
- Root and package README updates to surface these signals to both GitHub readers and npm package-page readers.

## What each badge/workflow does

- **Test badge (`test.yml`)**
  - Shows whether CI test/build checks currently pass.
- **CodeQL badge (`codeql.yml`)**
  - Indicates status of static security analysis for JavaScript/TypeScript.
- **Supply chain checks badge (`supply-chain-checks.yml`)**
  - Aggregates dependency review gating on PRs and scheduled OSV dependency vulnerability scans.
- **OpenSSF Scorecard badge**
  - Reflects Scorecard’s repository-level posture checks (for example branch protection and workflow hygiene).
- **npm version badges**
  - Show currently published package versions on npm for key end-user packages.

## What these signals do NOT prove

These signals do **not** prove:

- absence of vulnerabilities,
- absence of malicious code,
- perfect dependency hygiene,
- suitability for every environment or threat model.

They provide evidence of process, traceability, and ongoing checks.

## Manual setup still required (GitHub/npm settings)

Trusted publishing cannot be fully enabled from repository files alone. A maintainer must configure npm trusted publishers for each package:

1. In npm package settings, add a trusted publisher for repository `yu-iskw/dbt-artifacts-parser-ts`.
2. Bind each published package to its corresponding workflow file:
   - `.github/workflows/publish-dbt-artifacts-parser.yml`
   - `.github/workflows/publish-dbt-tools.yml`
3. Ensure package visibility/access settings remain public where intended.
4. After trusted publishers are active and validated, remove any no-longer-needed long-lived `NPM_TOKEN` secrets from GitHub repository/org settings.

Optional hardening steps:

- Enforce branch protection and required status checks for `main`.
- Enable GitHub Advanced Security features in repository/org settings if not already enabled.

## Why this is a trust/evidence model (not proof)

Software supply-chain trust is probabilistic and layered. Provenance and CI scans increase accountability and detection coverage, but they do not mathematically prove software is free from defects or malicious behavior. This repo therefore presents these controls as **evidence signals** so users can make informed risk decisions.
