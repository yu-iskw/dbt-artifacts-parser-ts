import { useEffect, useRef, useState } from "react";
import {
  AnalysisWorkspace,
  type WorkspaceView,
  type WorkspaceSignal,
  type OverviewFilterState,
  type ResultsFilterState,
  type TimelineFilterState,
  type AssetViewState,
  type RunsViewState,
  type ExecutionViewState,
  type QualityFilterState,
  type DependenciesViewState,
  type SearchViewState,
} from "./components/AnalysisWorkspace";
import { AppSidebar } from "./components/AppShell/AppSidebar";
import {
  getActiveNavigationItem,
  getInitialView,
  getInitialSidebarCollapsed,
  parseRunsKind,
  parseExecutionTab,
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
import { useTheme } from "./hooks/useTheme";
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
  const { theme, toggleTheme } = useTheme();
  const [activeView, setActiveViewRaw] =
    useState<WorkspaceView>(getInitialView);
  const [sidebarCollapsed, setSidebarCollapsedRaw] = useState(
    getInitialSidebarCollapsed,
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Legacy filter states (used by HealthView / backward compat) ──
  const [overviewFilters, setOverviewFilters] = useState<OverviewFilterState>({
    status: "all",
    resourceTypes: new Set(),
    query: "",
  });
  const [resultsFilters, setResultsFilters] = useState<ResultsFilterState>({
    status: "all",
    query: "",
  });
  const [timelineFilters, setTimelineFilters] = useState<TimelineFilterState>({
    query: "",
    activeStatuses: new Set(),
    activeTypes: new Set(),
  });

  // ── Legacy runs view state (kept for AnalysisWorkspace backward compat) ──
  const [runsViewState, setRunsViewState] = useState<RunsViewState>({
    tab: parseExecutionTab(window.location.search) ?? "results",
    kind: parseRunsKind(window.location.search) ?? "models",
  });

  // ── New view states ──
  const [executionViewState, setExecutionViewState] =
    useState<ExecutionViewState>({
      tab: parseExecutionTab(window.location.search) ?? "results",
    });

  const [qualityFilters, setQualityFilters] = useState<QualityFilterState>({
    status: "all",
    query: "",
  });

  const [dependenciesViewState, setDependenciesViewState] =
    useState<DependenciesViewState>({
      selectedResourceId: null,
      upstreamDepth: 2,
      downstreamDepth: 2,
      allDepsMode: false,
      lensMode: "type",
      activeLegendKeys: new Set(),
    });

  const [searchViewState, setSearchViewState] = useState<SearchViewState>({
    query: "",
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
  };

  /**
   * Programmatic navigation from inspector quick-actions.
   * Allows any lens to send the user to another lens with an optional
   * resource pre-selected.
   */
  const handleNavigateTo = (view: WorkspaceView, resourceId?: string) => {
    setActiveViewRaw(view);
    if (view === "inventory" && resourceId) {
      setAssetViewState((current) => ({
        ...current,
        selectedResourceId: resourceId,
      }));
    }
    if (view === "dependencies" && resourceId) {
      setDependenciesViewState((current) => ({
        ...current,
        selectedResourceId: resourceId,
      }));
    }
  };

  // ── URL sync effect ──
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", activeView);

    if (activeView === "inventory") {
      if (assetViewState.selectedResourceId) {
        url.searchParams.set("resource", assetViewState.selectedResourceId);
      } else {
        url.searchParams.delete("resource");
      }
      url.searchParams.delete("tab");
      url.searchParams.delete("kind");
    } else if (activeView === "execution") {
      url.searchParams.set("tab", executionViewState.tab);
      url.searchParams.delete("kind");
      url.searchParams.delete("resource");
    } else if (activeView === "dependencies" && dependenciesViewState.selectedResourceId) {
      url.searchParams.set("resource", dependenciesViewState.selectedResourceId);
      url.searchParams.delete("tab");
      url.searchParams.delete("kind");
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
    executionViewState.tab,
    dependenciesViewState.selectedResourceId,
  ]);

  useEffect(() => {
    const onPopState = () => {
      const search = window.location.search;
      const v = parseViewFromSearch(search);
      if (v) setActiveViewRaw(v);
      setExecutionViewState((current) => ({
        ...current,
        tab: parseExecutionTab(search) ?? current.tab,
      }));
      setRunsViewState((current) => ({
        ...current,
        tab: parseExecutionTab(search) ?? current.tab,
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
    executionViewState,
  );
  const workspaceTitle = activeNavigationItem.label;

  // Workspace signals are passed to HealthView for its hero strip.
  const workspaceSignals: WorkspaceSignal[] = analysis
    ? (buildWorkspaceSignals(analysis, analysisSource) as unknown as WorkspaceSignal[])
    : [];

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
        executionViewState={executionViewState}
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

          <div className="app-header__brand">
            <button
              type="button"
              className="app-header__brand-btn"
              onClick={() => handleNavigateTo("health")}
              title="Go to Health"
            >
              <span className="brand-mark">db</span>
              <span className="app-header__brand-name">dbt-tools</span>
            </button>
          </div>

          <div className="app-header__context">
            {analysis && (
              <span className="app-header__run-context" title="Run context">
                {analysis.resources.length} assets
                <span className="app-header__context-sep">·</span>
                {analysis.summary.total_nodes} executions
              </span>
            )}
          </div>

          <div className="app-header__actions">
            {analysis ? (
              <>
                <span className="app-badge">
                  {analysisSource === "preload"
                    ? "DBT_TARGET"
                    : "Uploaded files"}
                </span>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={toggleTheme}
                  aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                >
                  {theme === "light" ? "🌙 Dark" : "☀️ Light"}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={onLoadDifferent}
                >
                  Load different
                </button>
              </>
            ) : (
              <button
                type="button"
                className="secondary-action"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              >
                {theme === "light" ? "🌙 Dark" : "☀️ Light"}
              </button>
            )}
          </div>
        </header>

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
            executionViewState={executionViewState}
            onExecutionViewStateChange={setExecutionViewState}
            qualityFilters={qualityFilters}
            onQualityFiltersChange={setQualityFilters}
            dependenciesViewState={dependenciesViewState}
            onDependenciesViewStateChange={setDependenciesViewState}
            searchViewState={searchViewState}
            onSearchViewStateChange={setSearchViewState}
            onNavigateTo={handleNavigateTo}
            workspaceSignals={workspaceSignals}
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
