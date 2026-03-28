import type { Dispatch, SetStateAction } from "react";
import { AnalysisWorkspace, type WorkspaceSignal } from "../AnalysisWorkspace";
import { ErrorBanner } from "../ErrorBanner";
import { FileUpload } from "../FileUpload";
import type { Theme } from "@web/hooks/useTheme";
import type { WorkspacePreferences } from "@web/hooks/useWorkspacePreferences";
import {
  formatRunStartedAt,
  getInvocationTimestamp,
} from "@web/lib/analysis-workspace/utils";
import type { ThemePreference } from "@web/lib/analysis-workspace/types";
import type { UseWorkspaceUrlStateResult } from "@web/hooks/useWorkspaceUrlState";
import { useOmniboxResults } from "@web/hooks/useOmniboxResults";
import type { AnalysisLoadResult } from "@web/services/analysisLoader";
import type { AnalysisState } from "@web/types";
import { AppSidebar } from "./AppSidebar";
import { LoadingCard } from "./LoadingCard";
import { SettingsView } from "./SettingsView";

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
  themePreference: ThemePreference;
  setThemePreference: Dispatch<SetStateAction<ThemePreference>>;
  preferences: WorkspacePreferences;
  setPreferences: Dispatch<SetStateAction<WorkspacePreferences>>;
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
  themePreference,
  setThemePreference,
  preferences,
  setPreferences,
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
  const headerMeta = analysis
    ? [
        analysis.invocationId ? `Invocation ${analysis.invocationId}` : null,
        getInvocationTimestamp(analysis) != null
          ? formatRunStartedAt(getInvocationTimestamp(analysis)!)
          : null,
      ].filter((value): value is string => Boolean(value))
    : [];

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

          <div className="app-header__identity">
            <p className="eyebrow">Workspace session</p>
            {headerMeta.length > 0 ? (
              <div className="app-header__context">
                <span className="app-header__run-context" title="Run context">
                  {headerMeta.join(" · ")}
                </span>
              </div>
            ) : (
              <div className="app-header__context">
                <span className="app-header__run-context">
                  No invocation metadata available
                </span>
              </div>
            )}
            <div className="app-header__chip-row">
              <span className="app-badge">
                {analysisSource === "preload"
                  ? "Live target"
                  : analysisSource === "upload"
                    ? "Local upload"
                    : "Waiting for artifacts"}
              </span>
              <span className="settings-chip">
                {activeView === "settings" ? "Settings" : "Analysis workspace"}
              </span>
              <span className="settings-chip">
                {theme === "dark" ? "Dark canvas" : "Light canvas"}
              </span>
            </div>
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
        </header>

        {error && <ErrorBanner message={error} />}

        {activeView === "settings" ? (
          <SettingsView
            preferences={preferences}
            setPreferences={setPreferences}
            themePreference={themePreference}
            setThemePreference={setThemePreference}
            analysisSource={analysisSource}
            executionCount={analysis?.summary.total_nodes ?? null}
            onLoadDifferent={onLoadDifferent}
          />
        ) : analysis ? (
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
