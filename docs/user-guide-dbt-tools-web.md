# User guide: @dbt-tools/web

Operator-focused documentation for the **dbt-tools** browser analyzer: **deterministic, artifact-driven** views for dependencies, execution, and inventory—**no LLM required**. Remote artifact sources (S3/GCS) are optional, explicitly configured server-side infrastructure ([ADR-0029](./adr/0029-remote-object-storage-artifact-sources-and-auto-reload.md)). Positioning: [ADR-0035](./adr/0035-dbt-tools-operational-intelligence-and-positioning-boundaries.md). For a short npm-first overview, see the [package README](../packages/dbt-tools/web/README.md). For development setup, see [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Vite dev server (monorepo)

When you run `pnpm dev` / `pnpm dev:web` from the repository, **Vite** serves the app with middleware that mirrors the same **`/api/...`** artifact routes as the published **`dbt-tools-web`** server. Additional **file watching** behavior applies only here.

### Preloading local artifacts

```bash
DBT_TOOLS_TARGET_DIR=./target pnpm dev
# from this package:
pnpm dev:target
```

Legacy env names (`DBT_TARGET`, `DBT_TARGET_DIR`) still work with a one-time deprecation warning; prefer **`DBT_TOOLS_TARGET_DIR`**.

Open the URL Vite prints (e.g. `http://localhost:5173/`).

### Load artifacts (UI)

Without env prefill, use the in-app **Load artifacts** panel: choose **local**, **S3**, or **GCS**, enter a **location** (directory path or `s3://` / `gs://` bucket prefix), run **Discover**, then **select a run** when more than one complete `manifest.json` + `run_results.json` pair exists. Cloud credentials never enter the browser—they stay in the Node server (same model as `DBT_TOOLS_REMOTE_SOURCE` in [ADR-0029](./adr/0029-remote-object-storage-artifact-sources-and-auto-reload.md)).

### Debug logging

- **Server-side (Vite middleware):** `DBT_TOOLS_DEBUG=1` (legacy: `DBT_DEBUG`)
- **Client-side:** add **`?debug=1`** to the URL

```bash
DBT_TOOLS_DEBUG=1 DBT_TOOLS_TARGET_DIR=~/path/to/target pnpm dev
# then: http://localhost:5173/?debug=1
```

### Auto-reload when artifacts change

When `DBT_TOOLS_TARGET_DIR` is set under Vite, the app can **reload and re-analyze** after `manifest.json` or `run_results.json` change on disk (e.g. after `dbt run`):

| Variable                       | Default | Description                                    |
| ------------------------------ | ------- | ---------------------------------------------- |
| `DBT_TOOLS_WATCH`              | on      | Set to `0` to disable watching and auto-reload |
| `DBT_TOOLS_RELOAD_DEBOUNCE_MS` | `300`   | Debounce (ms) for rapid writes                 |

Legacy: `DBT_WATCH`, `DBT_RELOAD_DEBOUNCE_MS`.

```bash
DBT_TOOLS_WATCH=0 DBT_TOOLS_TARGET_DIR=./target pnpm dev
```

### Full Vite / build env reference

| Variable                       | Default | Description                                                                                                                              |
| ------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `DBT_TOOLS_TARGET_DIR`         | —       | Enables serving artifacts via `/api/*` middleware                                                                                        |
| `DBT_TOOLS_REMOTE_SOURCE`      | —       | JSON for S3/GCS bucket + prefix (server-side only); see [ADR-0029](./adr/0029-remote-object-storage-artifact-sources-and-auto-reload.md) |
| `DBT_TOOLS_DEBUG`              | unset   | `1` enables server-side debug logging                                                                                                    |
| `DBT_TOOLS_WATCH`              | on      | `0` disables file watching (Vite dev)                                                                                                    |
| `DBT_TOOLS_RELOAD_DEBOUNCE_MS` | `300`   | Reload debounce (Vite dev)                                                                                                               |

**Deprecated (still read):** `DBT_TARGET`, `DBT_TARGET_DIR`, `DBT_DEBUG`, `DBT_WATCH`, `DBT_RELOAD_DEBOUNCE_MS`.

### Remote artifact sources (`DBT_TOOLS_REMOTE_SOURCE`)

The dev server (and **`dbt-tools-web`**) can list keys under a bucket prefix, discover complete **`manifest.json` + `run_results.json`** pairs (non-recursive layout: root files or one subdirectory level per candidate), **poll** for changes, and surface newer runs in the UI **without switching your selected run automatically**. Credentials stay in the **Node process** (AWS default chain, GCS ADC / `GOOGLE_APPLICATION_CREDENTIALS`), not in the browser.

Details and semantics: [ADR-0029](./adr/0029-remote-object-storage-artifact-sources-and-auto-reload.md).

Example (shape only — adjust bucket/prefix):

```bash
export DBT_TOOLS_REMOTE_SOURCE='{"provider":"s3","bucket":"my-bucket","prefix":"dbt/runs","pollIntervalMs":30000}'
pnpm dev
```

---

## Published server vs static Docker image

- **`dbt-tools-web`** (npm): Node HTTP server + static `dist/` + artifact middleware. Honors **`DBT_TOOLS_TARGET_DIR`**, **`DBT_TOOLS_REMOTE_SOURCE`**, **`DBT_TOOLS_DEBUG`**. Does **not** use Vite file-watch env vars.
- **Dockerfile (nginx):** builds static **`dist/`** and serves it with **nginx**. There is **no** Node artifact middleware in that image unless you change the deployment shape, so the same **`DBT_TOOLS_*`** server env vars **do not apply** to that container as shipped.

---

## Docker (monorepo build)

The image is a multi-stage build: Node installs workspace dependencies and runs `pnpm --filter @dbt-tools/web build`; the final stage serves **`dist/`** with [nginx unprivileged](https://hub.docker.com/r/nginxinc/nginx-unprivileged) (non-root, port **8080**, SPA fallback to `index.html`).

**Build context must be the monorepo root** (not `packages/dbt-tools/web` alone).

```bash
docker build -f packages/dbt-tools/web/Dockerfile -t dbt-tools-web:local .
docker run --rm -p 8080:8080 dbt-tools-web:local
```

Open `http://localhost:8080/`.

**Vite build-time** variables (`VITE_*`), if introduced, must be passed at **image build** time (e.g. `docker build --build-arg ...`) and wired in the Dockerfile.

### GitHub Container Registry (CI)

Workflow: [`.github/workflows/docker-dbt-tools-web.yml`](../.github/workflows/docker-dbt-tools-web.yml) — builds on `push` to `main`, `pull_request` (build only), and `workflow_dispatch`. Images are pushed to **GHCR**:

`ghcr.io/<github-owner-lowercase>/dbt-tools-web`

Tags include a **git SHA** on pushes to `main` (and manual runs), and **`latest`** for default-branch builds.

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u USERNAME --password-stdin
docker pull ghcr.io/<github-owner-lowercase>/dbt-tools-web:latest
```

Set package visibility under the repository **Packages** settings if needed.

---

## Architecture (Vite dev detail)

```mermaid
graph TD
  FS["./target/\nmanifest.json\nrun_results.json"]
  VDS[Vite_dev_server\nmiddleware]
  APP[React_app]
  WW[Web_Worker]
  CORE["@dbt-tools/core/browser"]

  FS -->|file_watch_optional| VDS
  VDS -->|GET_/api/...| APP
  APP -->|postMessage| WW
  WW --> CORE
  CORE -->|results| WW
  WW -->|postMessage| APP
```

---

## Troubleshooting

| Symptom                              | Fix                                                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Blank page / "No artifacts found"    | Ensure **`DBT_TOOLS_TARGET_DIR`** points at a directory containing **`manifest.json`**, or configure **`DBT_TOOLS_REMOTE_SOURCE`**. |
| Auto-reload not triggering (Vite)    | Ensure **`DBT_TOOLS_WATCH`** is not `0`; confirm read access to the target directory.                                               |
| Slow UI with large manifests         | Web worker + virtualization target large graphs; profile the main thread if still slow.                                             |
| `GET /api/manifest.json` returns 404 | **`DBT_TOOLS_TARGET_DIR`** unset, wrong path, or (remote) no complete pair discovered.                                              |
| Debug logs missing                   | Server: restart with **`DBT_TOOLS_DEBUG=1`**. Client: **`?debug=1`** on the URL.                                                    |
| Expected Vite HMR from npm install   | Use **`pnpm dev`** from the monorepo or run **`dbt-tools-web`** and refresh after artifact changes.                                 |

---

## Related

- [Package README](../packages/dbt-tools/web/README.md)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ADR-0029](./adr/0029-remote-object-storage-artifact-sources-and-auto-reload.md)
