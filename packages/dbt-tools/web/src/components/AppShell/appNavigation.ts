import type {
  AssetViewState,
  RunsKind,
  RunsTab,
  RunsViewState,
  WorkspaceView,
} from "../AnalysisWorkspace";

export interface SidebarNavigationTarget {
  id: string;
  label: string;
  view: WorkspaceView;
  runsTab?: RunsTab;
  runsKind?: RunsKind;
}

export interface NavigationSelectionTarget {
  view: WorkspaceView;
  runsTab?: RunsTab;
  runsKind?: RunsKind;
}

export const navigationItems: SidebarNavigationTarget[] = [
  {
    id: "overview",
    view: "overview",
    label: "Overview",
  },
  {
    id: "assets",
    view: "catalog",
    label: "Assets",
  },
  {
    id: "models",
    view: "runs",
    label: "Models",
    runsTab: "results",
    runsKind: "models",
  },
  {
    id: "tests",
    view: "runs",
    label: "Tests",
    runsTab: "results",
    runsKind: "tests",
  },
  {
    id: "timeline",
    view: "runs",
    label: "Timeline",
    runsTab: "timeline",
    runsKind: "models",
  },
];

const VALID_VIEWS = new Set<WorkspaceView>(["overview", "catalog", "runs"]);
const VALID_RUNS_TABS = new Set<RunsTab>(["results", "timeline"]);
const VALID_RUNS_KINDS = new Set<RunsKind>(["models", "tests"]);

export function parseViewFromSearch(search: string): WorkspaceView | null {
  const params = new URLSearchParams(search);
  const raw = params.get("view");
  if (raw && VALID_VIEWS.has(raw as WorkspaceView)) {
    return raw as WorkspaceView;
  }
  return null;
}

export function getInitialView(): WorkspaceView {
  return parseViewFromSearch(window.location.search) ?? "overview";
}

export function parseRunsTab(search: string): RunsTab | null {
  const raw = new URLSearchParams(search).get("tab");
  if (raw && VALID_RUNS_TABS.has(raw as RunsTab)) {
    return raw as RunsTab;
  }
  return null;
}

export function parseRunsKind(search: string): RunsKind | null {
  const raw = new URLSearchParams(search).get("kind");
  if (raw && VALID_RUNS_KINDS.has(raw as RunsKind)) {
    return raw as RunsKind;
  }
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
  runsViewState: RunsViewState,
): boolean {
  if (activeView !== target.view) return false;
  if (target.view === "catalog") {
    return true;
  }
  if (target.view === "runs") {
    if ((target.runsTab ?? "results") !== runsViewState.tab) return false;
    if ((target.runsTab ?? "results") === "results") {
      return (target.runsKind ?? "models") === runsViewState.kind;
    }
    return true;
  }
  return true;
}

export function getActiveNavigationItem(
  activeView: WorkspaceView,
  assetViewState: AssetViewState,
  runsViewState: RunsViewState,
): SidebarNavigationTarget {
  return (
    navigationItems.find((item) =>
      isNavigationTargetActive(item, activeView, assetViewState, runsViewState),
    ) ?? navigationItems[0]
  );
}
