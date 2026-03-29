import path from "node:path";
import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import type { Plugin } from "vite";
import {
  getDbtToolsReloadDebounceMs,
  getDbtToolsTargetDirFromEnv,
  isDbtToolsDebugEnabled,
  isDbtToolsWatchEnabled,
} from "@dbt-tools/core";
import { ArtifactSourceService } from "./artifact-source/sourceService";
import { MANIFEST_JSON, RUN_RESULTS_JSON } from "./artifact-source/discovery";

function debugLog(...args: unknown[]) {
  if (isDbtToolsDebugEnabled()) {
    console.log("[dbt-target]", ...args);
  }
}

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
      debugLog("Artifacts changed, notified clients");
    }, debounceMs);
  };

  fs.watch(resolved, (_eventType, filename) => {
    if (filename === MANIFEST_JSON || filename === RUN_RESULTS_JSON) {
      notify();
    }
  });

  debugLog("Watching for artifact changes:", resolved);
}

function resolveTargetDirForWatch(): string | null {
  const raw = getDbtToolsTargetDirFromEnv() ?? "";
  const targetDir = raw
    .replace(/^~($|\/)/, `${process.env.HOME ?? ""}$1`)
    .trim();
  if (!targetDir) return null;

  const cwd = process.cwd();
  const resolved = path.resolve(cwd, targetDir);

  if (!path.isAbsolute(targetDir)) {
    const relative = path.relative(cwd, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      console.warn(
        "[dbt-target] DBT_TOOLS_TARGET_DIR resolved outside cwd, skipping:",
        resolved,
      );
      return null;
    }
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    console.warn(
      "[dbt-target] DBT_TOOLS_TARGET_DIR is not a directory:",
      resolved,
    );
    return null;
  }

  return resolved;
}

async function readJsonBody(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

function sendJson(
  res: {
    setHeader: (name: string, value: string) => void;
    statusCode: number;
    end: (body?: string) => void;
  },
  statusCode: number,
  payload: unknown,
) {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

/**
 * Vite plugin that serves the current artifact source and keeps the local
 * preload HMR reload loop for DBT_TOOLS_TARGET_DIR.
 */
export function dbtTargetPlugin(): Plugin {
  return {
    name: "dbt-target",
    enforce: "pre",
    configureServer(server) {
      const service = new ArtifactSourceService();

      server.middlewares.use((req, res, next) => {
        void (async () => {
          const pathname = req.url?.split("?")[0];
          if (!pathname) {
            next();
            return;
          }

          if (req.method === "GET" && pathname === "/api/artifact-source") {
            sendJson(res, 200, await service.getStatus());
            return;
          }

          if (
            req.method === "POST" &&
            pathname === "/api/artifact-source/switch"
          ) {
            const body = await readJsonBody(req);
            const runId =
              typeof body.runId === "string" && body.runId.trim() !== ""
                ? body.runId
                : undefined;
            sendJson(res, 200, await service.switchToRun(runId));
            return;
          }

          if (
            req.method === "GET" &&
            (pathname === `/api/${MANIFEST_JSON}` ||
              pathname === `/api/artifacts/current/${MANIFEST_JSON}` ||
              pathname === `/api/${RUN_RESULTS_JSON}` ||
              pathname === `/api/artifacts/current/${RUN_RESULTS_JSON}`)
          ) {
            const current = await service.getCurrentArtifacts();
            if (current == null) {
              res.statusCode = 404;
              res.end();
              return;
            }

            const bytes = pathname.endsWith(MANIFEST_JSON)
              ? current.manifestBytes
              : current.runResultsBytes;
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(Buffer.from(bytes));
            return;
          }

          next();
        })();
      });

      if (isDbtToolsWatchEnabled() && server.ws) {
        const resolved = resolveTargetDirForWatch();
        if (resolved != null) {
          try {
            setupArtifactWatch(resolved, server);
          } catch (watchErr) {
            debugLog("Watch failed:", watchErr);
          }
        }
      }
    },
  };
}
