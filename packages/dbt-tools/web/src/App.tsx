import { useEffect, useState } from "react";
import {
  AnalysisWorkspace,
  type WorkspaceView,
} from "./components/AnalysisWorkspace";
import { ErrorBanner } from "./components/ErrorBanner";
import { FileUpload } from "./components/FileUpload";
import { useAnalysisPage } from "./hooks/useAnalysisPage";

const navigationItems: Array<{
  view: WorkspaceView;
  label: string;
  description: string;
  abbr: string;
}> = [
  {
    view: "overview",
    label: "Overview",
    description: "Run health and bottlenecks",
    abbr: "Ov",
  },
  {
    view: "assets",
    label: "Assets",
    description: "Manifest resource explorer",
    abbr: "As",
  },
  {
    view: "results",
    label: "Results",
    description: "Execution log and statuses",
    abbr: "Re",
  },
  {
    view: "timeline",
    label: "Timeline",
    description: "Runtime sequencing",
    abbr: "Ti",
  },
];

function AppSidebar({
  activeView,
  setActiveView,
  sidebarCollapsed,
  setSidebarCollapsed,
  analysis,
  analysisSource,
}: {
  activeView: WorkspaceView;
  setActiveView: (v: WorkspaceView) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (fn: (c: boolean) => boolean) => void;
  analysis: { summary: { total_nodes: number } } | null;
  analysisSource: "preload" | "upload" | null;
}) {
  return (
    <aside
      className={`app-sidebar${sidebarCollapsed ? " app-sidebar--collapsed" : ""}`}
    >
      <button
        type="button"
        className="app-sidebar__brand-link"
        onClick={() => setActiveView("overview")}
        title="Go to overview"
      >
        <div className="brand-mark">db</div>
        {!sidebarCollapsed && (
          <div>
            <strong>dbt-tools</strong>
            <span>Visual run workspace</span>
          </div>
        )}
      </button>
      <nav className="app-sidebar__nav" aria-label="Workspace sections">
        {navigationItems.map((item) => {
          const disabled = !analysis;
          const active = activeView === item.view;
          return (
            <button
              key={item.view}
              type="button"
              className={
                active ? "sidebar-link sidebar-link--active" : "sidebar-link"
              }
              disabled={disabled}
              onClick={() => setActiveView(item.view)}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className="sidebar-link__abbr" aria-hidden="true">
                {item.abbr}
              </span>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
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

function App() {
  const {
    analysis,
    analysisSource,
    error,
    preloadLoading,
    onLoadDifferent,
    onAnalysis,
    onError,
  } = useAnalysisPage();
  const [activeView, setActiveView] = useState<WorkspaceView>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!analysis) setActiveView("overview");
  }, [analysis]);

  const workspaceTitle =
    activeView === "overview"
      ? "Workspace overview"
      : activeView === "assets"
        ? "Asset investigation"
        : activeView === "results"
          ? "Execution results"
          : "Execution timeline";
  const workspaceSummary = analysis
    ? `${analysis.graphSummary.totalNodes} nodes · ${analysis.summary.total_nodes} executions · ${analysisSource === "preload" ? "Auto-loaded from DBT_TARGET" : "Loaded from uploaded artifacts"}`
    : "Upload a manifest and run results to open the analysis workspace.";

  return (
    <div className="app-frame">
      <AppSidebar
        activeView={activeView}
        setActiveView={setActiveView}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        analysis={analysis}
        analysisSource={analysisSource}
      />
      <main className="app-main">
        <header className="app-header">
          <div>
            <p className="eyebrow">dbt artifacts workspace</p>
            <h1>{workspaceTitle}</h1>
            <p className="app-header__summary">{workspaceSummary}</p>
          </div>

          <div className="app-header__actions">
            {analysis && (
              <>
                <span className="app-badge">
                  {analysisSource === "preload"
                    ? "DBT_TARGET"
                    : "Uploaded files"}
                </span>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={onLoadDifferent}
                >
                  Load different artifacts
                </button>
              </>
            )}
          </div>
        </header>

        {error && <ErrorBanner message={error} />}

        {analysis ? (
          <AnalysisWorkspace analysis={analysis} activeView={activeView} />
        ) : preloadLoading ? (
          <div className="loading-card">
            <div className="loading-card__pulse" />
            <div>
              <h2>Loading workspace</h2>
              <p>
                Checking whether artifacts are available from the local target.
              </p>
            </div>
          </div>
        ) : (
          <FileUpload onAnalysis={onAnalysis} onError={onError} />
        )}
      </main>
    </div>
  );
}

export default App;
