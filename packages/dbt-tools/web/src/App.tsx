import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnalysisWorkspace,
  type AssetViewState,
  type InvestigationSelectionState,
  type LineageViewState,
  type OverviewFilterState,
  type RunsViewState,
  type SearchState,
  type TimelineFilterState,
  type WorkspaceSignal,
  type WorkspaceView,
} from "./components/AnalysisWorkspace";
import { AppSidebar } from "./components/AppShell/AppSidebar";
import {
  buildInitialLineageViewState,
  getInitialAssetTab,
  getInitialSidebarCollapsed,
  getInitialView,
  parseRunsKind,
  parseSelectedExecutionId,
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
import { matchesResource } from "./lib/analysis-workspace/utils";
import type { AnalysisState } from "@web/types";

/* eslint-disable max-lines-per-function, sonarjs/cognitive-complexity */
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
  const [overviewFilters, setOverviewFilters] = useState<OverviewFilterState>({
    status: "all",
    resourceTypes: new Set(),
    query: "",
  });
  const [timelineFilters, setTimelineFilters] = useState<TimelineFilterState>(
    () => {
      const search = window.location.search;
      const view = parseViewFromSearch(search);
      const selected =
        view === "runs" || view === "timeline"
          ? parseSelectedExecutionId(search)
          : null;
      return {
        query: "",
        activeStatuses: new Set(),
        activeTypes: new Set(),
        selectedExecutionId: selected,
        showTests: false,
        failuresOnly: false,
        dependencyDirection: "both",
        dependencyDepthHops: 2,
        timeWindow: null,
      };
    },
  );
  const [assetViewState, setAssetViewState] = useState<AssetViewState>(() => {
    const search = window.location.search;
    return {
      activeTab: getInitialAssetTab(search),
      expandedNodeIds: new Set(),
      explorerMode: "project",
      status: "all",
      resourceTypes: new Set(),
      resourceQuery: "",
      selectedResourceId: parseSelectedResourceId(search),
      upstreamDepth: 2,
      downstreamDepth: 2,
      allDepsMode: false,
      lensMode: "type",
      activeLegendKeys: new Set(),
    };
  });
  const [runsViewState, setRunsViewState] = useState<RunsViewState>(() => {
    const search = window.location.search;
    const view = parseViewFromSearch(search);
    return {
      kind: parseRunsKind(search) ?? "all",
      status: "all",
      query: "",
      resourceTypes: new Set(),
      threadIds: new Set(),
      durationBand: "all",
      sortBy: "attention",
      groupBy: "none",
      selectedExecutionId:
        view === "runs" ? parseSelectedExecutionId(search) : null,
    };
  });
  const [lineageViewState, setLineageViewState] = useState<LineageViewState>(
    () => buildInitialLineageViewState(window.location.search),
  );
  const [searchState, setSearchState] = useState<SearchState>({
    query: "",
    recentResourceIds: [],
    isOpen: false,
  });
  const [investigationSelection, setInvestigationSelection] =
    useState<InvestigationSelectionState>(() => {
      const search = window.location.search;
      const view = parseViewFromSearch(search) ?? "health";
      const resourceId = parseSelectedResourceId(search);
      const selectedParam = parseSelectedExecutionId(search);
      return {
        selectedResourceId: resourceId,
        selectedExecutionId:
          view === "runs" || view === "timeline" ? selectedParam : null,
        sourceLens: null,
      };
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
    setActiveViewRaw(target.view === "search" ? "inventory" : target.view);
  };

  const handleNavigateTo = (
    view: WorkspaceView,
    options?: {
      resourceId?: string;
      executionId?: string;
      assetTab?: AssetViewState["activeTab"];
      rootResourceId?: string;
    },
  ) => {
    setActiveViewRaw(view);
    if (options?.resourceId) {
      setAssetViewState((current) => ({
        ...current,
        selectedResourceId: options.resourceId ?? current.selectedResourceId,
        activeTab: options.assetTab ?? current.activeTab,
      }));
      setLineageViewState((current) => ({
        ...current,
        rootResourceId:
          options.rootResourceId ??
          options.resourceId ??
          current.rootResourceId,
        selectedResourceId: options.resourceId ?? current.selectedResourceId,
      }));
    } else if (options?.assetTab && view === "inventory") {
      setAssetViewState((current) => ({
        ...current,
        activeTab: options.assetTab ?? current.activeTab,
      }));
    }
    if (options?.executionId) {
      setRunsViewState((current) => ({
        ...current,
        selectedExecutionId: options.executionId ?? current.selectedExecutionId,
      }));
      setTimelineFilters((current) => ({
        ...current,
        selectedExecutionId: options.executionId ?? current.selectedExecutionId,
      }));
    }
    if (view === "runs" && options?.resourceId) {
      setRunsViewState((current) => ({
        ...current,
        query: options.resourceId ?? current.query,
      }));
    }
    setInvestigationSelection((current) => ({
      selectedResourceId: options?.resourceId ?? current.selectedResourceId,
      selectedExecutionId: options?.executionId ?? current.selectedExecutionId,
      sourceLens: view,
    }));
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", activeView);

    if (activeView === "inventory") {
      if (assetViewState.selectedResourceId) {
        url.searchParams.set("resource", assetViewState.selectedResourceId);
      } else {
        url.searchParams.delete("resource");
      }
      url.searchParams.set("assetTab", assetViewState.activeTab);
      url.searchParams.delete("kind");
      if (assetViewState.activeTab === "lineage") {
        if (lineageViewState.selectedResourceId) {
          url.searchParams.set("selected", lineageViewState.selectedResourceId);
        } else {
          url.searchParams.delete("selected");
        }
        url.searchParams.set("up", String(lineageViewState.upstreamDepth));
        url.searchParams.set("down", String(lineageViewState.downstreamDepth));
        url.searchParams.set(
          "allDeps",
          lineageViewState.allDepsMode ? "1" : "0",
        );
        url.searchParams.set("lens", lineageViewState.lensMode);
      } else {
        url.searchParams.delete("selected");
        url.searchParams.delete("up");
        url.searchParams.delete("down");
        url.searchParams.delete("allDeps");
        url.searchParams.delete("lens");
      }
    } else if (activeView === "runs") {
      url.searchParams.set("kind", runsViewState.kind);
      if (runsViewState.selectedExecutionId) {
        url.searchParams.set("selected", runsViewState.selectedExecutionId);
      } else {
        url.searchParams.delete("selected");
      }
      url.searchParams.delete("resource");
      url.searchParams.delete("assetTab");
      url.searchParams.delete("up");
      url.searchParams.delete("down");
      url.searchParams.delete("allDeps");
      url.searchParams.delete("lens");
    } else if (activeView === "timeline") {
      if (timelineFilters.selectedExecutionId) {
        url.searchParams.set("selected", timelineFilters.selectedExecutionId);
      } else {
        url.searchParams.delete("selected");
      }
      url.searchParams.delete("resource");
      url.searchParams.delete("assetTab");
      url.searchParams.delete("kind");
      url.searchParams.delete("up");
      url.searchParams.delete("down");
      url.searchParams.delete("allDeps");
      url.searchParams.delete("lens");
    } else {
      url.searchParams.delete("resource");
      url.searchParams.delete("assetTab");
      url.searchParams.delete("selected");
      url.searchParams.delete("kind");
      url.searchParams.delete("up");
      url.searchParams.delete("down");
      url.searchParams.delete("allDeps");
      url.searchParams.delete("lens");
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.pushState(null, "", nextUrl);
    }
  }, [
    activeView,
    assetViewState,
    runsViewState,
    timelineFilters.selectedExecutionId,
    lineageViewState,
  ]);

  useEffect(() => {
    const onPopState = () => {
      const search = window.location.search;
      const view = parseViewFromSearch(search);
      if (view) setActiveViewRaw(view);
      const resourceId = parseSelectedResourceId(search);
      const selectedParam = parseSelectedExecutionId(search);

      setAssetViewState((current) => ({
        ...current,
        selectedResourceId: resourceId,
        activeTab: getInitialAssetTab(search),
      }));
      setRunsViewState((current) => ({
        ...current,
        kind: parseRunsKind(search) ?? current.kind,
        selectedExecutionId: view === "runs" ? selectedParam : null,
      }));
      setTimelineFilters((current) => ({
        ...current,
        selectedExecutionId: view === "timeline" ? selectedParam : null,
      }));
      setLineageViewState(() => buildInitialLineageViewState(search));
      setInvestigationSelection((current) => ({
        ...current,
        selectedResourceId: resourceId,
        selectedExecutionId:
          view === "runs" || view === "timeline" ? selectedParam : null,
        sourceLens: current.sourceLens,
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchState((current) => ({ ...current, isOpen: true }));
      }
      if (e.key === "Escape") {
        setSidebarOpen(false);
        setSearchState((current) => ({ ...current, isOpen: false }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const workspaceSignals: WorkspaceSignal[] = analysis
    ? (buildWorkspaceSignals(
        analysis,
        analysisSource,
      ) as unknown as WorkspaceSignal[])
    : [];

  const omniboxResults = useMemo(() => {
    if (!analysis) return [];
    if (!searchState.query.trim()) {
      return searchState.recentResourceIds
        .map(
          (id) =>
            analysis.resources.find((resource) => resource.uniqueId === id) ??
            null,
        )
        .filter(
          (resource): resource is NonNullable<typeof resource> =>
            resource != null,
        )
        .slice(0, 8);
    }
    return analysis.resources
      .filter((resource) => matchesResource(resource, searchState.query))
      .slice(0, 8);
  }, [analysis, searchState.query, searchState.recentResourceIds]);

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
      />

      <main className="app-main">
        <header className="app-header app-header--workspace">
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
            {analysis ? (
              <span className="app-header__run-context" title="Run context">
                {analysis.resources.length} assets
                <span className="app-header__context-sep">·</span>
                {analysis.summary.total_nodes} executions
              </span>
            ) : null}
          </div>

          <div className="app-header__omnibox">
            <label className="workspace-search workspace-search--global">
              <span>Search workspace</span>
              <input
                value={searchState.query}
                onFocus={() =>
                  setSearchState((current) => ({ ...current, isOpen: true }))
                }
                onChange={(e) =>
                  setSearchState((current) => ({
                    ...current,
                    query: e.target.value,
                    isOpen: true,
                  }))
                }
                placeholder="Search by name, path, type, or ID…"
                aria-label="Global search"
              />
            </label>
            {searchState.isOpen && analysis && (
              <div className="omnibox-results">
                {omniboxResults.length > 0 ? (
                  omniboxResults.map((resource) => (
                    <button
                      key={resource.uniqueId}
                      type="button"
                      className="omnibox-results__item"
                      onClick={() => {
                        setSearchState((current) => ({
                          ...current,
                          isOpen: false,
                          recentResourceIds: [
                            resource.uniqueId,
                            ...current.recentResourceIds.filter(
                              (id) => id !== resource.uniqueId,
                            ),
                          ].slice(0, 8),
                        }));
                        handleNavigateTo("inventory", {
                          resourceId: resource.uniqueId,
                          assetTab: "summary",
                        });
                      }}
                    >
                      <strong>{resource.name}</strong>
                      <span>{resource.resourceType}</span>
                    </button>
                  ))
                ) : (
                  <div className="omnibox-results__empty">
                    {searchState.query.trim()
                      ? "No matching resources"
                      : "Recent items will appear here"}
                  </div>
                )}
              </div>
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
                  {theme === "light" ? "Dark" : "Light"}
                </button>
                <button type="button" className="secondary-action">
                  {analysisSource === "preload"
                    ? "Live target"
                    : "Local upload"}
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
                {theme === "light" ? "Dark" : "Light"}
              </button>
            )}
          </div>
        </header>

        {error && <ErrorBanner message={error} />}

        {analysis ? (
          <AnalysisWorkspace
            analysis={analysis}
            activeView={activeView}
            analysisSource={analysisSource}
            overviewFilters={overviewFilters}
            onOverviewFiltersChange={setOverviewFilters}
            timelineFilters={timelineFilters}
            onTimelineFiltersChange={setTimelineFilters}
            assetViewState={assetViewState}
            onAssetViewStateChange={setAssetViewState}
            runsViewState={runsViewState}
            onRunsViewStateChange={setRunsViewState}
            lineageViewState={lineageViewState}
            onLineageViewStateChange={setLineageViewState}
            investigationSelection={investigationSelection}
            onInvestigationSelectionChange={setInvestigationSelection}
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
