import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactSourceStatus } from "../services/artifactSourceApi";

// Hoist the mock so it applies before module imports.
vi.mock("../artifact-source/sourceService", () => {
  class ArtifactSourceService {
    async getStatus(): Promise<ArtifactSourceStatus> {
      return {
        mode: "none",
        currentSource: null,
        label: "Waiting for artifacts",
        remoteProvider: null,
        remoteLocation: null,
        pollIntervalMs: null,
        currentRun: null,
        pendingRun: null,
        supportsSwitch: false,
        checkedAtMs: 0,
      };
    }
    async getCurrentArtifacts() {
      return null;
    }
    async switchToRun() {
      return this.getStatus();
    }
  }
  return { ArtifactSourceService };
});

function httpGet(
  url: string,
): Promise<{ status: number; body: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            body,
            contentType: res.headers["content-type"] ?? "",
          }),
        );
      })
      .on("error", reject);
  });
}

describe("resolveStaticPath", () => {
  // Import the real module (ArtifactSourceService is mocked above).
  let resolveStaticPath: (urlPath: string) => string;
  let DIST_DIR: string;

  beforeEach(async () => {
    const mod = await import("./serve");
    resolveStaticPath = mod.resolveStaticPath;
    // Derive DIST_DIR the same way serve.ts does: two levels above src/server/
    // In the test context __dirname = src/server, so DIST_DIR = web/dist
    DIST_DIR = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      "../../dist",
    );
  });

  it("maps root to DIST_DIR (caller handles directory → index.html fallback)", () => {
    const result = resolveStaticPath("/");
    // path.join(DIST_DIR, "/") may include a trailing separator; strip it.
    expect(path.resolve(result)).toBe(path.resolve(DIST_DIR));
  });

  it("maps a file path within dist", () => {
    const result = resolveStaticPath("/assets/main.js");
    expect(result).toBe(path.join(DIST_DIR, "assets", "main.js"));
  });

  it("blocks path traversal by falling back to index.html", () => {
    // A traversal attempt that tries to escape DIST_DIR
    const result = resolveStaticPath("/../../../etc/passwd");
    expect(result).toBe(path.join(DIST_DIR, "index.html"));
  });

  it("strips query strings before resolving", () => {
    const result = resolveStaticPath("/foo.js?v=123");
    expect(result).toBe(path.join(DIST_DIR, "foo.js"));
  });

  it("decodes percent-encoded characters", () => {
    const result = resolveStaticPath("/my%20file.js");
    expect(result).toBe(path.join(DIST_DIR, "my file.js"));
  });
});

describe("startServer", () => {
  let srv: http.Server | undefined;
  let listenPort: number;

  beforeEach(async () => {
    const { startServer } = await import("./serve");

    // Intercept http.createServer to capture the server instance so we can
    // close it after each test.
    const origCreate = http.createServer.bind(http);
    const spy = vi
      .spyOn(http, "createServer")
      .mockImplementation((handler?: http.RequestListener) => {
        const s = origCreate(handler);
        srv = s;
        return s;
      });

    await startServer(0);
    spy.mockRestore();

    listenPort = (srv!.address() as { port: number }).port;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (srv) {
      await new Promise<void>((r) => srv!.close(() => r()));
      srv = undefined;
    }
  });

  it("listens on a non-zero port", () => {
    expect(listenPort).toBeGreaterThan(0);
  });

  it("handles GET /api/artifact-source and returns JSON with mode=none", async () => {
    const { status, body, contentType } = await httpGet(
      `http://localhost:${listenPort}/api/artifact-source`,
    );
    expect(status).toBe(200);
    expect(contentType).toContain("application/json");
    const parsed = JSON.parse(body) as ArtifactSourceStatus;
    expect(parsed.mode).toBe("none");
  });

  it("serves index.html as the SPA fallback for unknown paths", async () => {
    // Create a temp directory with a minimal index.html and point DIST_DIR to it.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dbt-serve-fallback-"));
    fs.writeFileSync(path.join(tmpDir, "index.html"), "<!DOCTYPE html>SPA");

    // Patch fs helpers to redirect dist/ reads to tmpDir.
    const origExistsSync = fs.existsSync;
    const origStatSync = fs.statSync;
    const origReadStream = fs.createReadStream;

    vi.spyOn(fs, "existsSync").mockImplementation((p) =>
      origExistsSync(String(p).replace(/[/\\]dist[/\\]?$/, `/${path.basename(tmpDir)}/`) || String(p)),
    );

    // Simpler: just redirect calls whose path contains "dist" to tmpDir.
    vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      const s = String(p);
      if (s.includes(`${path.sep}dist`) || s.endsWith(`${path.sep}dist`)) {
        return origExistsSync(s.replace(/.*dist/, tmpDir));
      }
      return origExistsSync(p as string);
    });
    vi.spyOn(fs, "statSync").mockImplementation((p, opts?) => {
      const s = String(p);
      if (s.includes(`${path.sep}dist`) || s.endsWith(`${path.sep}dist`)) {
        return origStatSync(
          s.replace(/.*dist/, tmpDir),
          opts as Parameters<typeof fs.statSync>[1],
        ) as ReturnType<typeof fs.statSync>;
      }
      return origStatSync(p as string, opts as Parameters<typeof fs.statSync>[1]) as ReturnType<typeof fs.statSync>;
    });
    vi.spyOn(fs, "createReadStream").mockImplementation((p, opts?) => {
      const s = String(p);
      if (s.includes(`${path.sep}dist`) || s.endsWith(`${path.sep}dist`)) {
        return origReadStream(
          s.replace(/.*dist/, tmpDir),
          opts as Parameters<typeof fs.createReadStream>[1],
        ) as ReturnType<typeof fs.createReadStream>;
      }
      return origReadStream(
        p as Parameters<typeof fs.createReadStream>[0],
        opts as Parameters<typeof fs.createReadStream>[1],
      ) as ReturnType<typeof fs.createReadStream>;
    });

    const { status, body } = await httpGet(
      `http://localhost:${listenPort}/unknown-route`,
    );

    fs.rmSync(tmpDir, { recursive: true, force: true });

    expect(status).toBe(200);
    expect(body).toContain("SPA");
  });
});
