import path from "node:path";
import fs from "node:fs";
import type { Plugin } from "vite";
import {
  getDbtToolsReloadDebounceMs,
  getDbtToolsTargetDirFromEnv,
  isDbtToolsDebugEnabled,
  isDbtToolsWatchEnabled,
} from "@dbt-tools/core";

const MANIFEST_JSON = "manifest.json";
const RUN_RESULTS_JSON = "run_results.json";

function setupArtifactWatch(
  resolved: string,
  server: { ws?: { send: (type: string, data?: object) => void } },
) {
  const debounceMs = Math.max(0, getDbtToolsReloadDebounceMs());
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const notify = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      server.ws?.send("dbt-artifacts-changed", {});
      if (isDbtToolsDebugEnabled()) {
        console.log("[dbt-target] Artifacts changed, notified clients");
      }
    }, debounceMs);
  };

  fs.watch(resolved, (_eventType, filename) => {
    if (filename === MANIFEST_JSON || filename === RUN_RESULTS_JSON) {
      notify();
    }
  });
  if (isDbtToolsDebugEnabled()) {
    console.log("[dbt-target] Watching for artifact changes:", resolved);
  }
}

/**
 * Vite plugin that serves manifest.json and run_results.json from
 * `DBT_TOOLS_TARGET_DIR` (or legacy `DBT_TARGET`) during dev.
 * Only active when that directory is configured and command is "serve".
 */
export function dbtTargetPlugin(): Plugin {
  return {
    name: "dbt-target",
    enforce: "pre",
    configureServer(server) {
      const raw = getDbtToolsTargetDirFromEnv() ?? "";
      const targetDir = raw
        .replace(/^~($|\/)/, `${process.env.HOME ?? ""}$1`)
        .trim();
      if (!targetDir) return;

      const cwd = process.cwd();
      const resolved = path.resolve(cwd, targetDir);

      if (!path.isAbsolute(targetDir)) {
        const relative = path.relative(cwd, resolved);
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
          console.warn(
            "[dbt-target] DBT_TOOLS_TARGET_DIR resolved outside cwd, skipping:",
            resolved,
          );
          return;
        }
      }

      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
        console.warn(
          "[dbt-target] DBT_TOOLS_TARGET_DIR is not a directory:",
          resolved,
        );
        return;
      }

      if (isDbtToolsDebugEnabled()) {
        console.log("[dbt-target] Serving artifacts from:", resolved);
      }

      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" || !req.url) return next();

        const pathname = req.url.split("?")[0];
        let filePath: string | null = null;
        if (pathname === `/api/${MANIFEST_JSON}`) {
          filePath = path.join(resolved, MANIFEST_JSON);
        } else if (pathname === `/api/${RUN_RESULTS_JSON}`) {
          filePath = path.join(resolved, RUN_RESULTS_JSON);
        }

        if (!filePath) return next();

        let status = 404;
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          status = 200;
          res.end(content);
        } catch {
          res.statusCode = 404;
          res.end();
        }
        if (isDbtToolsDebugEnabled()) {
          console.log("[dbt-target] GET", pathname, "->", status, filePath);
        }
      });

      if (isDbtToolsWatchEnabled() && server.ws) {
        try {
          setupArtifactWatch(resolved, server);
        } catch (watchErr) {
          if (isDbtToolsDebugEnabled()) {
            console.warn("[dbt-target] Watch failed:", watchErr);
          }
        }
      }
    },
  };
}
