import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command, InvalidArgumentError } from "commander";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ArtifactSourceService } from "../artifact-source/sourceService";
import { tryHandleArtifactSourceViteRequest } from "../artifact-source/viteArtifactRoutes";

const DIST_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

function getMimeType(filePath: string): string {
  return (
    MIME_TYPES[path.extname(filePath).toLowerCase()] ??
    "application/octet-stream"
  );
}

async function serveFile(
  res: ServerResponse,
  filePath: string,
): Promise<boolean> {
  try {
    const data = await readFile(filePath);
    res.setHeader("Content-Type", getMimeType(filePath));
    res.statusCode = 200;
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

function openInBrowser(url: string): void {
  const [bin, ...args]: [string, ...string[]] =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", url]
        : ["xdg-open", url];
  execFile(bin, args, () => undefined);
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  service: ArtifactSourceService,
): Promise<void> {
  const pathname = (req.url ?? "/").split("?")[0];

  if (pathname.startsWith("/api/")) {
    const handled = await tryHandleArtifactSourceViteRequest(req, res, service);
    if (!handled) {
      res.statusCode = 404;
      res.end();
    }
    return;
  }

  // Resolve to an absolute path and guard against path traversal
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = path.resolve(DIST_DIR, rel);
  if (candidate.startsWith(DIST_DIR + path.sep)) {
    if (await serveFile(res, candidate)) return;
  }

  // SPA fallback: serve index.html for client-side routes
  if (await serveFile(res, path.join(DIST_DIR, "index.html"))) return;

  res.statusCode = 404;
  res.end("Not found");
}

function parsePort(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new InvalidArgumentError("Must be an integer between 1 and 65535.");
  }
  return n;
}

const program = new Command();

program
  .name("dbt-web")
  .description(
    "Serve the dbt-tools web interface for visual dbt artifact analysis",
  )
  .option("-p, --port <number>", "port to listen on", parsePort, 5173)
  .option(
    "--target-dir <path>",
    "dbt target directory containing manifest.json and run_results.json",
  )
  .option("--open", "open browser on startup")
  .action((options: { port: number; targetDir?: string; open?: boolean }) => {
    if (!existsSync(DIST_DIR)) {
      console.error(
        `Error: built assets not found at ${DIST_DIR}\n` +
          "Run 'pnpm --filter @dbt-tools/web build' first.",
      );
      process.exit(1);
    }

    if (options.targetDir !== undefined) {
      process.env["DBT_TOOLS_TARGET_DIR"] = options.targetDir;
    }

    const service = new ArtifactSourceService();

    createServer((req, res) => {
      void handleRequest(req, res, service);
    }).listen(options.port, () => {
      const url = `http://localhost:${String(options.port)}`;
      console.log(`\n  dbt-tools web  ➜  ${url}`);
      if (options.targetDir !== undefined) {
        console.log(`  Target dir:       ${options.targetDir}`);
      }
      console.log();
      if (options.open === true) {
        openInBrowser(url);
      }
    });
  });

program.parse();
