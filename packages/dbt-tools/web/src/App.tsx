import { useEffect, useRef, useState } from "react";
import {
  AnalysisWorkspace,
  type WorkspaceView,
  type OverviewFilterState,
  type ResultsFilterState,
  type TimelineFilterState,
  type AssetViewState,
  type RunsViewState,
} from "./components/AnalysisWorkspace";
import { AppSidebar } from "./components/AppShell/AppSidebar";
import {
  getActiveNavigationItem,
  getInitialView,
  getInitialSidebarCollapsed,
  parseRunsKind,
  parseRunsTab,
  parseSelectedResourceId,
  parseViewFromSearch,
  SIDEBAR_STORAGE_KEY,
  type NavigationSelectionTarget,
} from "./components/AppShell/appNavigation";
import { LoadingCard } from "./components/AppShell/LoadingCard";
import { buildWorkspaceSignals } from "./components/AppShell/workspaceSignals";
import { ErrorBanner } from "./components/ErrorBanner";
import { FileUpload } from "./components/FileUpload";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { useAnalysisPage } from "./hooks/useAnalysisPage";
import type { AnalysisState } from "@web/types";

function AppContent() {
  const { toast } = useToast();
  const {
    analysis,
    analysisSource,
    error,
    preloadLoading,
    onLoadDifferent,
    onAnalysis,
    onError,
  } = useAnalysisPage();
  const [activeView, setActiveViewRaw] =
    useState<WorkspaceView>(getInitialView);
  const [sidebarCollapsed, setSidebarCollapsedRaw] = useState(
    getInitialSidebarCollapsed,
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [overviewFilters, setOverviewFilters] = useState<OverviewFilterState>({
    status: "all",
    resourceTypes: new Set(),
    query: "",
  });
  const [resultsFilters, setResultsFilters] = useState<ResultsFilterState>({
    status: "all",
    query: "",
  });
  const [runsViewState, setRunsViewState] = useState<RunsViewState>({
    tab: parseRunsTab(window.location.search) ?? "results",
    kind: parseRunsKind(window.location.search) ?? "models",
  });
  const [timelineFilters, setTimelineFilters] = useState<TimelineFilterState>({
    query: "",
    activeStatuses: new Set(),
    activeTypes: new Set(),
  });
  const [assetViewState, setAssetViewState] = useState<AssetViewState>({
    explorerMode: "project",
    status: "all",
    resourceTypes: new Set(),
    resourceQuery: "",
    selectedResourceId: parseSelectedResourceId(window.location.search),
    upstreamDepth: 2,
    downstreamDepth: 2,
    allDepsMode: false,
    lensMode: "type",
    activeLegendKeys: new Set(),
  });

  const setSidebarCollapsed: (fn: (c: boolean) => boolean) => void = (fn) => {
    setSidebarCollapsedRaw((current) => {
      const next = fn(current);
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const setNavigationTarget = (target: NavigationSelectionTarget) => {
    setActiveViewRaw(target.view);
    if (target.view === "runs") {
      setRunsViewState((current) => ({
        ...current,
        tab: target.runsTab ?? "results",
        kind:
          (target.runsTab ?? "results") === "results"
            ? (target.runsKind ?? "models")
            : current.kind,
      }));
    }
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", activeView);
    if (activeView === "catalog") {
      if (assetViewState.selectedResourceId) {
        url.searchParams.set("resource", assetViewState.selectedResourceId);
      } else {
        url.searchParams.delete("resource");
      }
      url.searchParams.delete("tab");
      url.searchParams.delete("kind");
    } else if (activeView === "runs") {
      url.searchParams.set("tab", runsViewState.tab);
      url.searchParams.set("kind", runsViewState.kind);
      url.searchParams.delete("resource");
    } else {
      url.searchParams.delete("tab");
      url.searchParams.delete("kind");
      url.searchParams.delete("resource");
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.pushState(null, "", nextUrl);
    }
  }, [
    activeView,
    assetViewState.selectedResourceId,
    runsViewState.kind,
    runsViewState.tab,
  ]);

  useEffect(() => {
    const onPopState = () => {
      const search = window.location.search;
      const v = parseViewFromSearch(search);
      if (v) setActiveViewRaw(v);
      setRunsViewState((current) => ({
        ...current,
        tab: parseRunsTab(search) ?? current.tab,
        kind: parseRunsKind(search) ?? current.kind,
      }));
      setAssetViewState((current) => ({
        ...current,
        selectedResourceId: parseSelectedResourceId(search),
      }));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const prevAnalysisRef = useRef<AnalysisState | null>(null);

  useEffect(() => {
    if (analysis && !prevAnalysisRef.current && analysisSource === "preload") {
      toast(
        `Workspace loaded — ${analysis.summary.total_nodes} executions`,
        "positive",
      );
    }
    prevAnalysisRef.current = analysis;
  }, [analysis, analysisSource, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeNavigationItem = getActiveNavigationItem(
    activeView,
    assetViewState,
    runsViewState,
  );
  const workspaceTitle = activeNavigationItem.label;
  const workspaceSignals = analysis
    ? buildWorkspaceSignals(analysis, analysisSource)
    : [];
  const workspaceSummary = analysis
    ? `${analysis.resources.length} assets · ${analysis.summary.total_nodes} executions · ${analysisSource === "preload" ? "Auto-loaded from DBT_TARGET" : "Loaded from uploaded artifacts"}`
    : "Upload a manifest and run results to open the analysis workspace.";

  const frameClass = [
    "app-frame",
    sidebarCollapsed ? "app-frame--sidebar-collapsed" : "",
    sidebarOpen ? "app-frame--nav-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={frameClass}>
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          role="presentation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AppSidebar
        activeView={activeView}
        setNavigationTarget={setNavigationTarget}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        onNavigate={() => setSidebarOpen(false)}
        analysis={analysis}
        analysisSource={analysisSource}
        assetViewState={assetViewState}
        runsViewState={runsViewState}
      />

      <main className="app-main">
        <header className="app-header">
          <button
            type="button"
            className="hamburger-btn"
            aria-label="Open navigation"
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            onClick={() => setSidebarOpen(true)}
          >
            <span aria-hidden="true">☰</span>
          </button>

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

        {analysis && (
          <section className="workspace-signals" aria-label="Workspace signals">
            {workspaceSignals.map((signal) => (
              <article
                key={signal.label}
                className={`signal-card signal-card--${signal.tone}`}
              >
                <p className="signal-card__label">{signal.label}</p>
                <strong>{signal.value}</strong>
                <span>{signal.detail}</span>
              </article>
            ))}
          </section>
        )}

        {error && <ErrorBanner message={error} />}

        {analysis ? (
          <AnalysisWorkspace
            analysis={analysis}
            activeView={activeView}
            activeViewTitle={workspaceTitle}
            analysisSource={analysisSource}
            overviewFilters={overviewFilters}
            onOverviewFiltersChange={setOverviewFilters}
            resultsFilters={resultsFilters}
            onResultsFiltersChange={setResultsFilters}
            timelineFilters={timelineFilters}
            onTimelineFiltersChange={setTimelineFilters}
            assetViewState={assetViewState}
            onAssetViewStateChange={setAssetViewState}
            runsViewState={runsViewState}
          />
        ) : preloadLoading ? (
          <LoadingCard />
        ) : (
          <FileUpload onAnalysis={onAnalysis} onError={onError} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
