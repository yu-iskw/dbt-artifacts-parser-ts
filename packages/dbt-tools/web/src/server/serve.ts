import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ArtifactSourceService } from "../artifact-source/sourceService.js";
import { tryHandleArtifactSourceViteRequest } from "../artifact-source/viteArtifactRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// At runtime this file lives at dist-serve/server/serve.js
// so dist/ is two levels up.
const DIST_DIR = path.resolve(__dirname, "../../dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
};

export function resolveStaticPath(urlPath: string): string {
  const safe = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
  const decoded = decodeURIComponent(safe.split("?")[0]);
  // Prevent path traversal
  const joined = path.join(DIST_DIR, decoded);
  if (!joined.startsWith(DIST_DIR + path.sep) && joined !== DIST_DIR) {
    return path.join(DIST_DIR, "index.html");
  }
  return joined;
}

function serveStaticFile(filePath: string, res: http.ServerResponse): void {
  let target = filePath;
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    target = path.join(DIST_DIR, "index.html");
  }
  const ext = path.extname(target).toLowerCase();
  res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
  res.statusCode = 200;
  fs.createReadStream(target).pipe(res);
}

export function startServer(port: number): Promise<void> {
  const service = new ArtifactSourceService();

  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        const handled = await tryHandleArtifactSourceViteRequest(
          req,
          res,
          service,
        );
        if (handled) return;

        const urlPath = req.url ?? "/";
        serveStaticFile(resolveStaticPath(urlPath), res);
      } catch (err) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("Internal server error");
        }
        console.error("[dbt-tools-web]", err);
      }
    })();
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve();
    });
  });
}
