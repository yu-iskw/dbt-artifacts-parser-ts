import path from "path";
import chokidar from "chokidar";
import type { BroadcastFn } from "./serve-websocket";

/**
 * Watches manifest.json and run_results.json inside targetDir.
 * Broadcasts a dbt-artifacts-changed event whenever either file is written.
 * Returns a function that stops the watcher.
 */
export function startArtifactWatcher(
  targetDir: string,
  broadcast: BroadcastFn,
): () => void {
  const watched = [
    path.join(targetDir, "manifest.json"),
    path.join(targetDir, "run_results.json"),
  ];

  const watcher = chokidar.watch(watched, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  watcher.on("change", () => {
    broadcast({ type: "dbt-artifacts-changed" });
  });

  return () => { void watcher.close(); };
}
