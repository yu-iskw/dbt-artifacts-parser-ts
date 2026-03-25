import type { AnalysisState } from "@web/types";
import type {
  AssetViewState,
  ExecutionViewState,
  RunsViewState,
  WorkspaceView,
} from "../AnalysisWorkspace";
import {
  type NavigationSelectionTarget,
  isNavigationTargetActive,
  navigationGroups,
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
  executionViewState,
}: {
  activeView: WorkspaceView;
  setNavigationTarget: (target: NavigationSelectionTarget) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (fn: (c: boolean) => boolean) => void;
  onNavigate: () => void;
  analysis: AnalysisState | null;
  analysisSource: "preload" | "upload" | null;
  assetViewState: AssetViewState;
  runsViewState: RunsViewState;
  executionViewState?: ExecutionViewState;
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
          setNavigationTarget({ view: "health" });
          onNavigate();
        }}
        title="Go to Health"
      >
        <div className="brand-mark">db</div>
        {!sidebarCollapsed && (
          <div>
            <strong>dbt-tools</strong>
            <span>Artifact operations console</span>
          </div>
        )}
      </button>

      <nav className="app-sidebar__nav" aria-label="Workspace sections">
        {navigationGroups.map((group) => (
          <div key={group.label} className="nav-group">
            {!sidebarCollapsed && (
              <p className="nav-group__label">{group.label}</p>
            )}
            {group.items.map((item) => {
              const disabled = !analysis;
              const active = isNavigationTargetActive(
                item,
                activeView,
                assetViewState,
                runsViewState,
                executionViewState,
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
          </div>
        ))}
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
