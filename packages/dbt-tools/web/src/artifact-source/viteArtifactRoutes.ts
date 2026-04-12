import type { IncomingMessage, ServerResponse } from "node:http";
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
} from "../../../core/src/io/artifact-filenames";
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

function sendError(
  res: ServerResponse,
  message: string,
  statusCode = 400,
): void {
  sendJson(res, statusCode, { message });
}

function currentArtifactBytes(
  pathname: string,
  current: Awaited<ReturnType<ArtifactSourceService["getCurrentArtifacts"]>>,
): Uint8Array | null {
  if (current == null) return null;
  if (pathname.endsWith(DBT_MANIFEST_JSON)) return current.manifestBytes;
  if (pathname.endsWith(DBT_RUN_RESULTS_JSON)) return current.runResultsBytes;
  if (pathname.endsWith(DBT_CATALOG_JSON)) return current.catalogBytes ?? null;
  if (pathname.endsWith(DBT_SOURCES_JSON)) return current.sourcesBytes ?? null;
  return null;
}

const CURRENT_ARTIFACT_PATHS = new Set([
  `/api/${DBT_MANIFEST_JSON}`,
  `/api/artifacts/current/${DBT_MANIFEST_JSON}`,
  `/api/${DBT_RUN_RESULTS_JSON}`,
  `/api/artifacts/current/${DBT_RUN_RESULTS_JSON}`,
  `/api/${DBT_CATALOG_JSON}`,
  `/api/artifacts/current/${DBT_CATALOG_JSON}`,
  `/api/${DBT_SOURCES_JSON}`,
  `/api/artifacts/current/${DBT_SOURCES_JSON}`,
]);

function requestPathname(req: IncomingMessage): string | null {
  return req.url?.split("?")[0] ?? null;
}

function parseSourceType(value: unknown): "local" | "s3" | "gcs" | null {
  return value === "local" || value === "s3" || value === "gcs" ? value : null;
}

async function handleDiscoverRequest(
  req: IncomingMessage,
  res: ServerResponse,
  service: ArtifactSourceService,
): Promise<boolean> {
  if (
    req.method !== "POST" ||
    requestPathname(req) !== "/api/artifact-source/discover"
  ) {
    return false;
  }

  const body = await readJsonBody(req);
  const sourceType = parseSourceType(body.sourceType);
  if (sourceType == null || typeof body.location !== "string") {
    sendError(res, "Invalid discovery request payload.");
    return true;
  }

  try {
    sendJson(
      res,
      200,
      await service.discover({ sourceType, location: body.location }),
    );
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : "Failed to discover artifacts",
    );
  }
  return true;
}

async function handleLoadRequest(
  req: IncomingMessage,
  res: ServerResponse,
  service: ArtifactSourceService,
): Promise<boolean> {
  if (
    req.method !== "POST" ||
    requestPathname(req) !== "/api/artifact-source/load"
  ) {
    return false;
  }

  const body = await readJsonBody(req);
  const sourceType = parseSourceType(body.sourceType);
  if (
    sourceType == null ||
    typeof body.location !== "string" ||
    typeof body.candidateId !== "string"
  ) {
    sendError(res, "Invalid load request payload.");
    return true;
  }

  try {
    sendJson(
      res,
      200,
      await service.loadCandidate({
        sourceType,
        location: body.location,
        candidateId: body.candidateId,
      }),
    );
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : "Failed to load artifacts",
    );
  }
  return true;
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
  const pathname = requestPathname(req);
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

  if (await handleDiscoverRequest(req, res, service)) return true;
  if (await handleLoadRequest(req, res, service)) return true;

  if (req.method !== "GET" || !CURRENT_ARTIFACT_PATHS.has(pathname)) {
    return false;
  }

  const current = await service.getCurrentArtifacts();
  const bytes = currentArtifactBytes(pathname, current);
  if (bytes == null) {
    res.statusCode = 404;
    res.end();
    return true;
  }

  res.setHeader("Content-Type", "application/json");
  res.statusCode = 200;
  res.end(Buffer.from(bytes));
  return true;
}
