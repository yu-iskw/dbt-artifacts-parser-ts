import fs from "fs";
import path from "path";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import type { BroadcastFn } from "./serve-websocket";

const PUBLIC_DIR = path.join(__dirname, "..", "public");

/**
 * Creates an Express app that:
 * - Serves the pre-built SPA from ../public/
 * - Injects __DBT_SERVE_MODE__=true into index.html at request time
 * - Exposes /api/manifest.json, /api/run_results.json, /api/catalog.json
 * - Exposes /api/status for health checks
 * - Falls back to index.html for SPA client-side routing
 */
export function createServeApp(
  targetDir: string,
  port: number,
  _broadcast: BroadcastFn,
): Express {
  const app = express();

  // Artifact API routes — stream files directly from disk
  app.get("/api/manifest.json", (_req, res) => {
    streamArtifact(res, path.join(targetDir, "manifest.json"));
  });

  app.get("/api/run_results.json", (_req, res) => {
    streamArtifact(res, path.join(targetDir, "run_results.json"));
  });

  app.get("/api/catalog.json", (_req, res) => {
    streamArtifact(res, path.join(targetDir, "catalog.json"));
  });

  app.get("/api/status", (_req, res) => {
    res.json({ ready: true, targetDir, port });
  });

  // Static assets (JS, CSS, etc.) — served directly without modification
  app.use(
    "/assets",
    express.static(path.join(PUBLIC_DIR, "assets"), { index: false }),
  );

  // Rate-limit the SPA shell route: it reads index.html from disk on every hit
  const spaLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // All other routes return the SPA shell with serve-mode flag injected
  app.get("*", spaLimiter, (_req, res) => {
    const indexPath = path.join(PUBLIC_DIR, "index.html");
    if (!fs.existsSync(indexPath)) {
      res
        .status(503)
        .send("SPA build not found. Run: pnpm --filter @dbt-tools/web build");
      return;
    }
    const html = fs.readFileSync(indexPath, "utf8");
    const injected = html.replace(
      "</head>",
      `<script>window.__DBT_SERVE_MODE__=true;</script></head>`,
    );
    res.type("html").send(injected);
  });

  return app;
}

function streamArtifact(res: express.Response, filePath: string): void {
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Artifact not found", path: filePath });
    return;
  }
  res.type("json");
  fs.createReadStream(filePath)
    .on("error", (err: NodeJS.ErrnoException) => {
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to read artifact" });
      } else {
        res.destroy();
      }
    })
    .pipe(res);
}
