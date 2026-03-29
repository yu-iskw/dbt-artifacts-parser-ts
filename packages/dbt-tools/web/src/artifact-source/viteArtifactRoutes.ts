import type { IncomingMessage, ServerResponse } from "node:http";
import { MANIFEST_JSON, RUN_RESULTS_JSON } from "./discovery";
import type { ArtifactSourceService } from "./sourceService";

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
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
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

  if (req.method === "GET" && pathname === "/api/artifact-source") {
    sendJson(res, 200, await service.getStatus());
    return true;
  }

  if (req.method === "POST" && pathname === "/api/artifact-source/switch") {
    const body = await readJsonBody(req);
    const runId =
      typeof body.runId === "string" && body.runId.trim() !== ""
        ? body.runId
        : undefined;
    sendJson(res, 200, await service.switchToRun(runId));
    return true;
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
      return true;
    }

    const bytes = pathname.endsWith(MANIFEST_JSON)
      ? current.manifestBytes
      : current.runResultsBytes;
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(Buffer.from(bytes));
    return true;
  }

  return false;
}
