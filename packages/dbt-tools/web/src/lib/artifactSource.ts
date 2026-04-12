import type { WorkspaceArtifactSource } from "@web/lib/artifactSourceKind";

export function sourceLabel(source: WorkspaceArtifactSource | null): string {
  if (source === "preload") return "Live target";
  if (source === "remote") return "Remote source";
  if (source === "upload") return "Local upload";
  if (source === "runtime") return "Loaded from location";
  return "Waiting for artifacts";
}

export function sourceBadgeLabel(
  source: WorkspaceArtifactSource | null,
): string {
  if (source === "preload") return "DBT_TOOLS_TARGET_DIR";
  if (source === "remote") return "REMOTE SOURCE";
  if (source === "upload") return "UPLOADED";
  if (source === "runtime") return "RUNTIME";
  return "ARTIFACTS";
}
