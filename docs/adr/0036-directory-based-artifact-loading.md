# 36. Directory/prefix-based artifact loading

Date: 2026-04-12

## Status

Accepted

Depends-on [29. Remote object storage artifact sources and auto-reload](0029-remote-object-storage-artifact-sources-and-auto-reload.md)

Depends-on [15. MVC-style layering for web app](0015-mvc-style-layering-for-web-app.md)

Depends-on [6. Artifact-first agent-first positioning of dbt-tools](0006-artifact-first-agent-first-positioning-of-dbt-tools.md)

## Context

ADR-0029 established a server-mediated remote artifact source architecture that discovers artifact pairs under an S3 or GCS prefix. The browser cannot specify a different source at runtime — the source is fixed by environment variables at server startup.

The web app provided a fallback: a multi-file browser picker (`FileUpload.tsx`) that lets users select `manifest.json` and `run_results.json` directly. While functional, this workflow has several drawbacks:

- Users must find and select individual files rather than pointing at a dbt project's output directory.
- File-by-file selection makes it impossible to discover multiple candidate run sets at one location.
- There is no mechanism to load from a local path or cloud prefix that was not pre-configured at server startup.
- The CLI lacks a uniform concept of "source type + location"; each command uses `--target-dir` independently with no awareness of remote sources.

We considered several extension approaches:

| Approach | Score | Notes |
|---|---|---|
| Keep file picker; add a separate "directory" option | 52 | Dual-mode UI; increases maintenance surface |
| Replace file picker with source type + location form backed by server-side discovery | 91 | Consistent with ADR-0029's server-ownership model; reuses existing discovery logic |
| Add browser-direct directory access via File System Access API | 44 | Browser-only, no cloud support, requires modern browser APIs |
| Keep everything as env-var-only configuration | 38 | Does not allow runtime source selection; poor UX for ad hoc use |

The key forces are:

- Cloud credentials must stay server-side (established in ADR-0029).
- Discovery logic already exists in `discovery.ts`; local discovery is the missing piece.
- Users in both web and CLI contexts need a uniform way to say "load from this location".
- The required-pair invariant (`manifest.json` + `run_results.json`) must be enforced at discovery time, not silently skipped.

## Decision

We replace the file-by-file browser picker with a **source type + location** workflow backed by server-side discovery, and align the CLI to the same conceptual model.

### Input model

Both the web app and CLI accept:

- **Source type**: `local`, `s3`, or `gcs`
- **Location**: a single directory path (local) or `bucket/prefix` string (S3/GCS)

### Discovery contract

A new shared module (`discoveryContract.ts`) defines the types that cross the server → browser boundary:

- `DiscoverArtifactsRequest` — source type + location
- `DiscoverArtifactsResponse` — list of `ArtifactCandidateSummary` objects, each carrying artifact presence flags and `missingOptional`
- `ActivateArtifactRequest` — source type + location + candidateId

Only candidates that contain both `manifest.json` and `run_results.json` are returned. The required pair is validated at discovery time; no partial loads occur.

### Required-pair invariant

If a location contains no candidate with both `manifest.json` and `run_results.json`, discovery returns an empty list with an `error` field that identifies the missing file(s). Loading is blocked until the invariant is satisfied.

### Optional artifact warnings and feature gating

A `artifactCapabilities.ts` module maps optional artifacts to the workspace features that depend on them:

- `catalog.json` → field-level lineage, column metadata
- `sources.json` → source freshness data

Missing optional artifacts produce warnings shown in the candidate-selection UI and do not block loading. Only the features that genuinely depend on the absent artifact are disabled.

### Multiple candidate sets

When discovery finds more than one valid candidate at a location, the UI presents all candidates for explicit selection. Auto-selection of the "best" candidate is not performed; user confirmation is required.

### Web app flow

The `LocationSourceLoader` component replaces `FileUpload.tsx` and implements a multi-step form:

1. Source type selection (local / S3 / GCS)
2. Location input
3. Server-side discovery via `POST /api/artifact-source/discover`
4. Candidate selection (skipped when exactly one candidate is found)
5. Activation via `POST /api/artifact-source/activate`, then artifact fetch via existing `/api/artifacts/current/*` paths

### Server-side implementation

`ArtifactSourceService` gains two methods:

- `discover(request)` — non-destructive scan that creates a temporary client/adapter, runs discovery, and returns candidates without changing the active adapter
- `activate(request)` — runs discovery, finds the selected candidate, creates the appropriate adapter (local or remote), and replaces `this.adapter`

For S3/GCS, credentials are taken from the server-configured `DBT_TOOLS_REMOTE_SOURCE` environment variable or the SDK default credential chain. The browser specifies only the bucket/prefix.

### Local discovery

`localArtifactDiscovery.ts` (in `@dbt-tools/core`) provides `discoverLocalArtifactRuns(dir)`:

- Checks the root directory itself (runId `"current"`) and each immediate subdirectory
- Returns only entries with both required artifacts
- Sorts newest-first by required artifact mtime
- Used by both the web server and the CLI

### CLI alignment

The CLI gains:

- A new `discover` command: `dbt-tools discover [--source-type local|s3|gcs] [--location <path>]`
  - Local discovery is fully supported
  - S3/GCS discovery in the CLI refers users to the web server (which has credential management)
- `--location <path>` option added to `status` and `freshness` commands as an alias for `--target-dir`
- `--source-type` option added to `status`, `freshness`, and `discover` for forward compatibility

### Source kind

A new `"runtime"` value is added to `WorkspaceArtifactSource` to identify workspaces loaded through the new source picker flow, distinct from env-var-configured `"preload"` and `"remote"` sources.

## Consequences

**Positive:**

- Users can specify any local directory or cloud prefix at runtime, without restarting the server.
- The required-pair invariant is enforced at discovery time rather than silently deferred.
- Optional artifact absence produces actionable warnings instead of silent feature degradation.
- Multiple candidate sets require explicit selection, preventing silent best-guess loading.
- The web app and CLI now share the same conceptual model for artifact location.
- The existing env-var-configured sources (preload, remote) continue to work unchanged.

**Negative / risks:**

- Local path discovery accepts arbitrary server-accessible paths (validated by `validateSafePath` to prevent traversal, but constrained only by OS permissions).
- S3/GCS discovery in the CLI is deferred to the web server; CLI users cannot yet discover remote sources directly.
- The `FileUpload.tsx` component is no longer the primary entry point; static-hosting deployments that relied on it now show the location-based form instead, which requires a server for cloud sources.

**Mitigations:**

- `validateSafePath()` is applied to all user-supplied local paths before filesystem access.
- The `FileUpload.tsx` file is retained in the codebase for potential future static-hosting fallback use.
- The `"runtime"` source kind is backward-compatible; existing code that switches on `WorkspaceArtifactSource` has a new case to handle gracefully.

## References

- [ADR-0006](0006-artifact-first-agent-first-positioning-of-dbt-tools.md) — artifact-first strategic positioning
- [ADR-0015](0015-mvc-style-layering-for-web-app.md) — web layering baseline
- [ADR-0028](0028-dbt-tools-prefix-for-dbt-tools-environment-variables.md) — canonical env var naming
- [ADR-0029](0029-remote-object-storage-artifact-sources-and-auto-reload.md) — backend-owned remote source model
