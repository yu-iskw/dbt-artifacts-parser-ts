import http from "http";
import path from "path";
import { attachWebSocketServer } from "./serve-websocket";
import { startArtifactWatcher } from "./serve-watcher";
import { createServeApp } from "./serve-server";

export interface ServeOptions {
  target: string;
  port: string;
  host: string;
  open: boolean;
}

export async function serveAction(options: ServeOptions): Promise<void> {
  const targetDir = path.resolve(options.target);
  const port = parseInt(options.port, 10);
  const host = options.host;

  const app = createServeApp(targetDir, port, () => undefined);
  const httpServer = http.createServer(app);

  // Attach WebSocket server to the same HTTP server (same port)
  const broadcast = attachWebSocketServer(httpServer);

  // Recreate the Express app with the real broadcast now that WS is ready
  // (pass broadcast so future extensions like on-ingest notify can use it)
  const finalApp = createServeApp(targetDir, port, broadcast);
  httpServer.removeAllListeners("request");
  httpServer.on("request", finalApp);

  // Start watching dbt target directory for artifact changes
  const stopWatcher = startArtifactWatcher(targetDir, broadcast);

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, host, () => {
      const url = `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
      console.log(`\ndbt-tools serve`);
      console.log(`  Workspace: ${url}`);
      console.log(`  Artifacts: ${targetDir}`);
      console.log(`  Watching:  manifest.json + run_results.json\n`);

      if (options.open) {
        openBrowser(url);
      }

      resolve();
    });
    httpServer.on("error", reject);
  });

  // Keep the process alive; clean up on SIGINT / SIGTERM
  await new Promise<void>((resolve) => {
    const shutdown = () => {
      stopWatcher();
      httpServer.close(() => resolve());
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}

function openBrowser(url: string): void {
  const { platform } = process;
  const cmd =
    platform === "darwin" ? "open" :
    platform === "win32"  ? "start" : "xdg-open";
  const { spawn } = require("child_process") as typeof import("child_process");
  spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
}
