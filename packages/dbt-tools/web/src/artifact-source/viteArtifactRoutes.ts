import type { IncomingMessage, ServerResponse } from "node:http";
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
} from "@dbt-tools/core";
import type { ArtifactSourceService } from "./sourceService";
import type {
  ActivateArtifactRequest,
  ArtifactSourceType,
  DiscoverArtifactsRequest,
} from "./discoveryContract";

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

function isArtifactStatusRequest(
  req: IncomingMessage,
  pathname: string,
): boolean {
  return req.method === "GET" && pathname === "/api/artifact-source";
}

function isArtifactSwitchRequest(
  req: IncomingMessage,
  pathname: string,
): boolean {
  return req.method === "POST" && pathname === "/api/artifact-source/switch";
}

function isArtifactDiscoverRequest(
  req: IncomingMessage,
  pathname: string,
): boolean {
  return req.method === "POST" && pathname === "/api/artifact-source/discover";
}

function isArtifactActivateRequest(
  req: IncomingMessage,
  pathname: string,
): boolean {
  return req.method === "POST" && pathname === "/api/artifact-source/activate";
}

function isCurrentArtifactRequest(
  req: IncomingMessage,
  pathname: string,
): boolean {
  return req.method === "GET" && CURRENT_ARTIFACT_PATHS.has(pathname);
}

const VALID_SOURCE_TYPES = new Set<ArtifactSourceType>(["local", "s3", "gcs"]);

function parseDiscoverBody(
  body: Record<string, unknown>,
): DiscoverArtifactsRequest | null {
  const { sourceType, location } = body;
  if (
    typeof sourceType !== "string" ||
    !VALID_SOURCE_TYPES.has(sourceType as ArtifactSourceType) ||
    typeof location !== "string" ||
    location.trim() === ""
  ) {
    return null;
  }
  return {
    sourceType: sourceType as ArtifactSourceType,
    location: location.trim(),
  };
}

function parseActivateBody(
  body: Record<string, unknown>,
): ActivateArtifactRequest | null {
  const { sourceType, location, candidateId } = body;
  if (
    typeof sourceType !== "string" ||
    !VALID_SOURCE_TYPES.has(sourceType as ArtifactSourceType) ||
    typeof location !== "string" ||
    location.trim() === "" ||
    typeof candidateId !== "string" ||
    candidateId.trim() === ""
  ) {
    return null;
  }
  return {
    sourceType: sourceType as ArtifactSourceType,
    location: location.trim(),
    candidateId: candidateId.trim(),
  };
}

async function handleDiscover(
  req: IncomingMessage,
  res: ServerResponse,
  service: ArtifactSourceService,
): Promise<void> {
  const body = await readJsonBody(req);
  const discoverReq = parseDiscoverBody(body);
  if (discoverReq == null) {
    sendJson(res, 400, {
      error: "invalid_request",
      message:
        'Request body must include "sourceType" (local|s3|gcs) and a non-empty "location".',
    });
    return;
  }
  const result = await service.discover(discoverReq);
  if (result.error != null && result.candidates.length === 0) {
    sendJson(res, 422, {
      error: "no_candidates",
      message: result.error,
      sourceType: result.sourceType,
      location: result.location,
      candidates: [],
    });
    return;
  }
  sendJson(res, 200, result);
}

async function handleActivate(
  req: IncomingMessage,
  res: ServerResponse,
  service: ArtifactSourceService,
): Promise<void> {
  const body = await readJsonBody(req);
  const activateReq = parseActivateBody(body);
  if (activateReq == null) {
    sendJson(res, 400, {
      error: "invalid_request",
      message:
        'Request body must include "sourceType" (local|s3|gcs), a non-empty "location", and a non-empty "candidateId".',
    });
    return;
  }
  try {
    sendJson(res, 200, await service.activate(activateReq));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isNotFound =
      message.includes("not found") || message.includes("No complete");
    sendJson(res, isNotFound ? 422 : 500, {
      error: isNotFound ? "activation_failed" : "internal_error",
      message,
    });
  }
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

  if (isArtifactStatusRequest(req, pathname)) {
    sendJson(res, 200, await service.getStatus());
    return true;
  }

  if (isArtifactSwitchRequest(req, pathname)) {
    const body = await readJsonBody(req);
    const runId =
      typeof body.runId === "string" && body.runId.trim() !== ""
        ? body.runId
        : undefined;
    sendJson(res, 200, await service.switchToRun(runId));
    return true;
  }

  if (isArtifactDiscoverRequest(req, pathname)) {
    await handleDiscover(req, res, service);
    return true;
  }

  if (isArtifactActivateRequest(req, pathname)) {
    await handleActivate(req, res, service);
    return true;
  }

  if (isCurrentArtifactRequest(req, pathname)) {
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

  return false;
}
