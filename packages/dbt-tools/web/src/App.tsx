import { useEffect, useState } from "react";
import {
  AnalysisWorkspace,
  type WorkspaceView,
} from "./components/AnalysisWorkspace";
import { ErrorBanner } from "./components/ErrorBanner";
import { FileUpload } from "./components/FileUpload";
import { useAnalysisPage } from "./hooks/useAnalysisPage";

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

  useEffect(() => {
    if (!analysis) {
      setActiveView("overview");
    }
  }, [analysis]);

  const navigationItems: Array<{
    view: WorkspaceView;
    label: string;
    description: string;
  }> = [
    {
      view: "overview",
      label: "Overview",
      description: "Run health and bottlenecks",
    },
    {
      view: "assets",
      label: "Assets",
      description: "Manifest resource explorer",
    },
    {
      view: "results",
      label: "Results",
      description: "Execution log and statuses",
    },
    {
      view: "timeline",
      label: "Timeline",
      description: "Runtime sequencing",
    },
  ];

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
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <div className="brand-mark">db</div>
          <div>
            <strong>dbt-tools</strong>
            <span>Visual run workspace</span>
          </div>
        </div>

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
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            );
          })}
        </nav>

        <div className="app-sidebar__footer">
          <p className="eyebrow">Session</p>
          <strong>
            {analysisSource === "preload" ? "Live target" : "Local upload"}
          </strong>
          <span>
            {analysis
              ? `${analysis.summary.total_nodes} executions analyzed`
              : "Waiting for artifacts"}
          </span>
        </div>
      </aside>

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
