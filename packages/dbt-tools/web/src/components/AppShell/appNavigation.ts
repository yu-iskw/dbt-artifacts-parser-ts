import type {
  AssetViewState,
  ExecutionViewState,
  RunsViewState,
  WorkspaceView,
} from "../AnalysisWorkspace";

export interface SidebarNavigationTarget {
  id: string;
  label: string;
  view: WorkspaceView;
  /** @deprecated Only used for legacy `runs` view compat */
  runsTab?: "results" | "timeline";
  /** @deprecated Only used for legacy `runs` view compat */
  runsKind?: "models" | "tests";
}

export interface SidebarNavGroup {
  label: string;
  items: SidebarNavigationTarget[];
}

export interface NavigationSelectionTarget {
  view: WorkspaceView;
  /** @deprecated */
  runsTab?: "results" | "timeline";
  /** @deprecated */
  runsKind?: "models" | "tests";
}

/**
 * Grouped navigation structure — Observe + Explore sections.
 */
export const navigationGroups: SidebarNavGroup[] = [
  {
    label: "Observe",
    items: [
      { id: "health", view: "health", label: "Health" },
      { id: "execution", view: "execution", label: "Execution" },
      { id: "quality", view: "quality", label: "Quality" },
    ],
  },
  {
    label: "Explore",
    items: [
      { id: "inventory", view: "inventory", label: "Inventory" },
      { id: "dependencies", view: "dependencies", label: "Dependencies" },
      { id: "search", view: "search", label: "Search" },
    ],
  },
];

/** Flat list of all navigation items (for backward compat helpers). */
export const navigationItems: SidebarNavigationTarget[] = navigationGroups.flatMap(
  (g) => g.items,
);

const VALID_VIEWS = new Set<WorkspaceView>([
  "health",
  "inventory",
  "execution",
  "quality",
  "dependencies",
  "search",
  // legacy redirect sources
  "overview",
  "catalog",
  "runs",
]);

const VALID_EXECUTION_TABS = new Set(["results", "timeline"]);

/**
 * Map legacy view param values to new canonical view names.
 */
export function resolveView(raw: string): WorkspaceView {
  if (raw === "overview") return "health";
  if (raw === "catalog") return "inventory";
  if (raw === "runs") return "execution";
  if (VALID_VIEWS.has(raw as WorkspaceView)) return raw as WorkspaceView;
  return "health";
}

export function parseViewFromSearch(search: string): WorkspaceView | null {
  const params = new URLSearchParams(search);
  const raw = params.get("view");
  if (raw && VALID_VIEWS.has(raw as WorkspaceView)) {
    return resolveView(raw);
  }
  return null;
}

export function getInitialView(): WorkspaceView {
  return parseViewFromSearch(window.location.search) ?? "health";
}

export function parseExecutionTab(search: string): "results" | "timeline" | null {
  const raw = new URLSearchParams(search).get("tab");
  if (raw && VALID_EXECUTION_TABS.has(raw)) return raw as "results" | "timeline";
  return null;
}

/** @deprecated Use parseExecutionTab */
export function parseRunsTab(search: string): "results" | "timeline" | null {
  return parseExecutionTab(search);
}

export function parseRunsKind(search: string): "models" | "tests" | null {
  const raw = new URLSearchParams(search).get("kind");
  if (raw === "models" || raw === "tests") return raw;
  return null;
}

export function parseSelectedResourceId(search: string): string | null {
  return new URLSearchParams(search).get("resource");
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
  _assetViewState: AssetViewState,
  _runsViewState: RunsViewState,
  _executionViewState?: ExecutionViewState,
): boolean {
  // Resolve legacy view names before comparing
  const resolvedActive =
    activeView === "overview"
      ? "health"
      : activeView === "catalog"
        ? "inventory"
        : activeView === "runs"
          ? "execution"
          : activeView;
  return resolvedActive === target.view;
}

export function getActiveNavigationItem(
  activeView: WorkspaceView,
  assetViewState: AssetViewState,
  runsViewState: RunsViewState,
  executionViewState?: ExecutionViewState,
): SidebarNavigationTarget {
  return (
    navigationItems.find((item) =>
      isNavigationTargetActive(
        item,
        activeView,
        assetViewState,
        runsViewState,
        executionViewState,
      ),
    ) ?? navigationItems[0]
  );
}
