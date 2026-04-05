# Security Policy

## Supported packages and versions

We currently support security reports for actively maintained versions of the public npm packages in this repository:

- `dbt-artifacts-parser`
- `@dbt-tools/core`
- `@dbt-tools/cli`
- `@dbt-tools/web`

Please reproduce issues on the latest published version before reporting when possible.

## Reporting a vulnerability

Please open a private security advisory through GitHub Security Advisories for this repository.

If private advisory submission is unavailable for your environment, open an issue requesting a secure contact channel **without** posting exploit details publicly.

When reporting, include:

- affected package name and version
- impact summary
- reproduction steps or proof of concept
- any known mitigations

## Security signals provided by this repository

This repository provides multiple trust and transparency signals:

- **Verified provenance for npm releases**: supported packages can be published from GitHub Actions using npm trusted publishing and provenance attestations.
- **Code scanning enabled**: CodeQL runs on pull requests, on pushes to `main`, and on a weekly schedule.
- **Dependency review on pull requests**: PRs are checked to prevent introducing known vulnerable dependencies.
- **Repository supply-chain posture tracking**: OpenSSF Scorecard runs regularly and publishes results.
- **Release-time runtime dependency checks**: `@dbt-tools/web` release flow audits the packed tarball install (`--omit=dev`) for known high/critical vulnerabilities before publish.

## Limitations of these signals

These controls improve transparency and reduce risk, but they are not guarantees.

- We do **not** claim to prove the absence of malicious code.
- We do **not** claim absolute safety.
- Automated scanning can miss issues, and new vulnerabilities may be disclosed after a release.
- Dependency checks focus on **known** vulnerabilities at check time.

## Notes for npm consumers

When a package is published with npm provenance, npm shows provenance information on the package page.

Consumers who need additional verification can inspect package provenance/attestation details using npm tooling and their own supply-chain policy checks.

## Maintainer setup notes (npm trusted publishing)

For each public npm package, configure npm Trusted Publisher settings in npmjs.com:

1. Go to package settings.
2. Configure publishing access for GitHub Actions trusted publishing.
3. Add this repository/workflow as a trusted publisher.
4. After validation, consider enforcing 2FA and disabling token-based publishing where appropriate.
