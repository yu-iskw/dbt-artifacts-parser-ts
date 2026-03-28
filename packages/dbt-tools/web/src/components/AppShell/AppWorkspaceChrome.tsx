import { AnalysisWorkspace, type WorkspaceSignal } from "../AnalysisWorkspace";
import { ErrorBanner } from "../ErrorBanner";
import { FileUpload } from "../FileUpload";
import type { Theme } from "@web/hooks/useTheme";
import type { UseWorkspaceUrlStateResult } from "@web/hooks/useWorkspaceUrlState";
import { useOmniboxResults } from "@web/hooks/useOmniboxResults";
import type { AnalysisLoadResult } from "@web/services/analysisLoader";
import type { AnalysisState } from "@web/types";
import { AppLogo } from "./AppLogo";
import { AppSidebar } from "./AppSidebar";
import { LoadingCard } from "./LoadingCard";

export interface AppWorkspaceChromeProps {
  workspace: UseWorkspaceUrlStateResult;
  analysis: AnalysisState | null;
  analysisSource: "preload" | "upload" | null;
  error: string | null;
  preloadLoading: boolean;
  onLoadDifferent: () => void;
  onAnalysis: (result: AnalysisLoadResult) => void;
  onError: (error: string | null) => void;
  theme: Theme;
  toggleTheme: () => void;
  workspaceSignals: WorkspaceSignal[];
}

export function AppWorkspaceChrome({
  workspace,
  analysis,
  analysisSource,
  error,
  preloadLoading,
  onLoadDifferent,
  onAnalysis,
  onError,
  theme,
  toggleTheme,
  workspaceSignals,
}: AppWorkspaceChromeProps) {
  const {
    activeView,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarOpen,
    setSidebarOpen,
    overviewFilters,
    setOverviewFilters,
    timelineFilters,
    setTimelineFilters,
    assetViewState,
    setAssetViewState,
    runsViewState,
    setRunsViewState,
    lineageViewState,
    setLineageViewState,
    searchState,
    setSearchState,
    investigationSelection,
    setInvestigationSelection,
    setNavigationTarget,
    handleNavigateTo,
    frameClass,
  } = workspace;

  const omniboxResults = useOmniboxResults(analysis, searchState);

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
              <AppLogo className="app-logo app-logo--brand" />
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
