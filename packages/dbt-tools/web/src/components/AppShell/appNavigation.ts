import type {
  AssetViewState,
  LineageViewState,
  RunsViewState,
  WorkspaceView,
} from "../AnalysisWorkspace";

export interface SidebarNavigationTarget {
  id: string;
  label: string;
  view: Exclude<
    WorkspaceView,
    "overview" | "catalog" | "execution" | "quality" | "dependencies" | "search"
  >;
}

export interface NavigationSelectionTarget {
  view: WorkspaceView;
}

export const navigationItems: SidebarNavigationTarget[] = [
  { id: "health", view: "health", label: "Health" },
  { id: "inventory", view: "inventory", label: "Inventory" },
  { id: "runs", view: "runs", label: "Runs" },
  { id: "timeline", view: "timeline", label: "Timeline" },
  { id: "lineage", view: "lineage", label: "Lineage" },
];

const VALID_VIEWS = new Set<WorkspaceView>([
  "health",
  "inventory",
  "runs",
  "timeline",
  "lineage",
  "overview",
  "catalog",
  "execution",
  "quality",
  "dependencies",
  "search",
]);

export function resolveView(raw: string): WorkspaceView {
  switch (raw) {
    case "overview":
      return "health";
    case "catalog":
      return "inventory";
    case "execution":
    case "quality":
      return "runs";
    case "dependencies":
      return "lineage";
    case "search":
      return "inventory";
    case "runs":
    case "timeline":
    case "lineage":
    case "inventory":
    case "health":
      return raw;
    default:
      return "health";
  }
}

export function parseViewFromSearch(search: string): WorkspaceView | null {
  const params = new URLSearchParams(search);
  const raw = params.get("view");
  if (raw && VALID_VIEWS.has(raw as WorkspaceView)) {
    if (raw === "runs" && params.get("tab") === "timeline") return "timeline";
    return resolveView(raw);
  }
  return null;
}

export function getInitialView(): WorkspaceView {
  return parseViewFromSearch(window.location.search) ?? "health";
}

export function parseSelectedResourceId(search: string): string | null {
  return new URLSearchParams(search).get("resource");
}

export function parseSelectedExecutionId(search: string): string | null {
  return new URLSearchParams(search).get("selected");
}

export function parseAssetTab(
  search: string,
): AssetViewState["activeTab"] | null {
  const raw = new URLSearchParams(search).get("assetTab");
  if (
    raw === "summary" ||
    raw === "lineage" ||
    raw === "sql" ||
    raw === "runtime" ||
    raw === "tests"
  ) {
    return raw;
  }
  return null;
}

export function parseRunsKind(search: string): RunsViewState["kind"] | null {
  const raw = new URLSearchParams(search).get("kind");
  if (
    raw === "all" ||
    raw === "models" ||
    raw === "tests" ||
    raw === "seeds" ||
    raw === "snapshots" ||
    raw === "operations"
  ) {
    return raw;
  }
  return null;
}

export function parseLineageLensMode(
  search: string,
): LineageViewState["lensMode"] | null {
  const raw = new URLSearchParams(search).get("lens");
  if (raw === "status" || raw === "type" || raw === "coverage") return raw;
  return null;
}

export const SIDEBAR_STORAGE_KEY = "dbt-tools.sidebarCollapsed";

export function getInitialSidebarCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    // ignore
  }
  return true;
}

export function isNavigationTargetActive(
  target: SidebarNavigationTarget,
  activeView: WorkspaceView,
): boolean {
  return resolveView(activeView) === target.view;
}

export function getActiveNavigationItem(
  activeView: WorkspaceView,
): SidebarNavigationTarget {
  return (
    navigationItems.find((item) =>
      isNavigationTargetActive(item, activeView),
    ) ?? navigationItems[0]
  );
}
