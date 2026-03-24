import type { AnalysisState } from "@web/types";
import type {
  AssetViewState,
  RunsViewState,
  WorkspaceView,
} from "../AnalysisWorkspace";
import {
  type NavigationSelectionTarget,
  isNavigationTargetActive,
  navigationItems,
} from "./appNavigation";
import { NavIcon } from "./NavIcon";

export function AppSidebar({
  activeView,
  setNavigationTarget,
  sidebarCollapsed,
  setSidebarCollapsed,
  onNavigate,
  analysis,
  analysisSource,
  assetViewState,
  runsViewState,
}: {
  activeView: WorkspaceView;
  setNavigationTarget: (target: NavigationSelectionTarget) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (fn: (c: boolean) => boolean) => void;
  /** Called after any navigation action so the parent can close the mobile overlay. */
  onNavigate: () => void;
  analysis: AnalysisState | null;
  analysisSource: "preload" | "upload" | null;
  assetViewState: AssetViewState;
  runsViewState: RunsViewState;
}) {
  return (
    <aside
      id="app-sidebar"
      className={`app-sidebar${sidebarCollapsed ? " app-sidebar--collapsed" : ""}`}
    >
      <button
        type="button"
        className="app-sidebar__brand-link"
        onClick={() => {
          setNavigationTarget({ view: "overview" });
          onNavigate();
        }}
        title="Go to overview"
      >
        <div className="brand-mark">db</div>
        {!sidebarCollapsed && (
          <div>
            <strong>dbt-tools</strong>
            <span>Catalog and runs workspace</span>
          </div>
        )}
      </button>
      <nav className="app-sidebar__nav" aria-label="Workspace sections">
        {navigationItems.map((item) => {
          const disabled = !analysis;
          const active = isNavigationTargetActive(
            item,
            activeView,
            assetViewState,
            runsViewState,
          );
          return (
            <button
              key={item.id}
              type="button"
              className={
                active ? "sidebar-link sidebar-link--active" : "sidebar-link"
              }
              disabled={disabled}
              onClick={() => {
                setNavigationTarget(item);
                onNavigate();
              }}
              aria-label={item.label}
              title={item.label}
            >
              <span className="sidebar-link__icon">
                <NavIcon id={item.id} />
              </span>
              <div className="sidebar-link__body">
                <strong>{item.label}</strong>
              </div>
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setSidebarCollapsed((c) => !c)}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {sidebarCollapsed ? "›" : "‹"}
      </button>
      {!sidebarCollapsed && (
        <div className="app-sidebar__footer">
          <p className="eyebrow">Session</p>
          <strong>
            {analysisSource === "preload" ? "Live target" : "Local upload"}
            {analysisSource === null && " (loading…)"}
          </strong>
          <span>
            {analysis
              ? `${analysis.summary.total_nodes} executions analyzed`
              : "Waiting for artifacts"}
          </span>
        </div>
      )}
    </aside>
  );
}
