import type { IncomingMessage, ServerResponse } from "node:http";
import { DBT_MANIFEST_JSON, DBT_RUN_RESULTS_JSON } from "@dbt-tools/core";
import type { ArtifactSourceService } from "./sourceService";

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

function getRequestedRunId(req: IncomingMessage): string | undefined {
  const rawUrl = req.url;
  if (!rawUrl) return undefined;
  const runId = new URL(rawUrl, "http://127.0.0.1").searchParams
    .get("runId")
    ?.trim();
  return runId ? runId : undefined;
}

/**
 * Vite middleware handler for artifact-source HTTP routes. Returns `true` when
 * the request was fully handled (response ended).
 */
export async function tryHandleArtifactSourceViteRequest(
  req: IncomingMessage,
  res: ServerResponse,
  service: ArtifactSourceService,
): Promise<boolean> {
  const pathname = req.url?.split("?")[0];
  if (!pathname) return false;
  const selectedRunId = getRequestedRunId(req);

  if (req.method === "GET" && pathname === "/api/artifact-source") {
    sendJson(res, 200, await service.getStatus(selectedRunId));
    return true;
  }

  if (
    req.method === "GET" &&
    (pathname === `/api/${DBT_MANIFEST_JSON}` ||
      pathname === `/api/artifacts/current/${DBT_MANIFEST_JSON}` ||
      pathname === `/api/${DBT_RUN_RESULTS_JSON}` ||
      pathname === `/api/artifacts/current/${DBT_RUN_RESULTS_JSON}`)
  ) {
    const current = await service.getCurrentArtifacts(selectedRunId);
    if (current == null) {
      res.statusCode = 404;
      res.end();
      return true;
    }

    const bytes = pathname.endsWith(DBT_MANIFEST_JSON)
      ? current.manifestBytes
      : current.runResultsBytes;
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(Buffer.from(bytes));
    return true;
  }

  return false;
}
