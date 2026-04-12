/**
 * How analysis buffers were obtained.
 * - preload:  server-configured local target dir (DBT_TOOLS_TARGET_DIR)
 * - remote:   server-configured remote object store (DBT_TOOLS_REMOTE_SOURCE)
 * - upload:   legacy browser file-picker upload (kept for static-host compatibility)
 * - runtime:  location activated at runtime via the source-picker UI
 * Shared by the analysis worker protocol and workspace UI; keep this module free of fetch/Node.
 */
export type WorkspaceArtifactSource =
  | "preload"
  | "remote"
  | "upload"
  | "runtime";
