import { type ThemeMode, getThemeHex } from "@web/constants/themeColors";
import type { StatusTone } from "@web/types";
import type { AssetExplorerMode } from "./types";

export function getStatusTonePalette(
  theme: ThemeMode,
): Record<StatusTone, string> {
  const t = getThemeHex(theme);
  return {
    positive: t.mint,
    warning: t.amber,
    danger: t.rose,
    neutral: t.slate,
  };
}

export const PILL_ACTIVE = "workspace-pill workspace-pill--active";
export const PILL_BASE = "workspace-pill";

export const PRIMARY_PROJECT_SUMMARY_GROUPS = [
  { key: "model", label: "Models" },
  { key: "tests", label: "Tests" },
  { key: "snapshot", label: "Snapshots" },
  { key: "metric", label: "Metrics" },
  { key: "semantic_model", label: "Semantic models" },
] as const;

export const PRIMARY_TIMELINE_TYPES = new Set([
  "model",
  "seed",
  "snapshot",
  "source",
  "source_freshness",
  "test",
  "unit_test",
  "metric",
  "semantic_model",
]);

// Resource types classified as "test" in the Results split
export const TEST_RESOURCE_TYPES = new Set(["test", "unit_test"]);

// Resource types that can have tests associated with them (for lineage/explorer stats)
export const SUPPORT_TESTS_RESOURCE_TYPES = new Set([
  "model",
  "seed",
  "snapshot",
  "source",
]);

export const EXPLORER_MODE_LABELS: Record<AssetExplorerMode, string> = {
  project: "Project",
  database: "Database",
};
