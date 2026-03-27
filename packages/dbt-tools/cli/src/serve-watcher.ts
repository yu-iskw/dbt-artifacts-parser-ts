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

  const notify = () => broadcast({ type: "dbt-artifacts-changed" });
  // `change` fires on modification; `add` fires on initial creation (first dbt run
  // after starting serve against an empty target/ directory).
  watcher.on("change", notify);
  watcher.on("add", notify);

  return () => {
    void watcher.close();
  };
}
