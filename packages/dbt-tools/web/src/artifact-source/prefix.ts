/** Trim leading/trailing slashes for object-store key prefix handling. */
export function normalizeArtifactPrefix(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, "");
}
