import { useEffect, useRef, useState } from "react";
import {
  AnalysisWorkspace,
  type WorkspaceView,
  type RunsTab,
  type RunsKind,
  type OverviewFilterState,
  type ResultsFilterState,
  type TimelineFilterState,
  type AssetViewState,
  type RunsViewState,
} from "./components/AnalysisWorkspace";
import { ErrorBanner } from "./components/ErrorBanner";
import { FileUpload } from "./components/FileUpload";
import { Skeleton } from "./components/ui/Skeleton";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { useAnalysisPage } from "./hooks/useAnalysisPage";
import type { AnalysisState } from "@web/types";

interface SidebarNavigationTarget {
  id: string;
  label: string;
  view: WorkspaceView;
  runsTab?: RunsTab;
  runsKind?: RunsKind;
}

interface NavigationSelectionTarget {
  view: WorkspaceView;
  runsTab?: RunsTab;
  runsKind?: RunsKind;
}

function NavIcon({ id }: { id: SidebarNavigationTarget["id"] }) {
  const svgProps = {
    viewBox: "0 0 24 24" as const,
    fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth: "1.8" as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    width: 20,
    height: 20,
    "aria-hidden": true as const,
  };

  if (id === "overview") {
    // Dashboard: 2×2 rounded grid
    return (
      <svg {...svgProps}>
        <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
      </svg>
    );
  }

  if (id === "assets") {
    // Lineage/network: branching paths (DAG concept)
    return (
      <svg {...svgProps}>
        <circle cx="5.5" cy="6.5" r="2" />
        <circle cx="5.5" cy="17.5" r="2" />
        <circle cx="18.5" cy="12" r="2" />
        <path d="M7.5 6.5 Q13 6.5 16.5 12" />
        <path d="M7.5 17.5 Q13 17.5 16.5 12" />
      </svg>
    );
  }

  if (id === "models") {
    return (
      <svg {...svgProps}>
        <path d="M2 7l10-4 10 4-10 4-10-4z" />
        <path d="M2 12l10 4 10-4" />
        <path d="M2 17l10 4 10-4" />
      </svg>
    );
  }

  if (id === "tests") {
    return (
      <svg {...svgProps}>
        <path d="M12 3l7 3v5c0 4.6-2.7 8.8-7 10-4.3-1.2-7-5.4-7-10V6l7-3z" />
        <path d="m9.2 12 2 2 3.8-4.2" />
      </svg>
    );
  }

  return (
    <svg {...svgProps}>
      <path d="M4 7h16" />
      <path d="M4 12h9" />
      <path d="M4 17h13" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

const navigationItems: SidebarNavigationTarget[] = [
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

function parseViewFromSearch(search: string): WorkspaceView | null {
  const params = new URLSearchParams(search);
  const raw = params.get("view");
  if (raw && VALID_VIEWS.has(raw as WorkspaceView)) {
    return raw as WorkspaceView;
  }
  return null;
}

function getInitialView(): WorkspaceView {
  return parseViewFromSearch(window.location.search) ?? "overview";
}

function parseRunsTab(search: string): RunsTab | null {
  const raw = new URLSearchParams(search).get("tab");
  if (raw && VALID_RUNS_TABS.has(raw as RunsTab)) {
    return raw as RunsTab;
  }
  return null;
}

function parseRunsKind(search: string): RunsKind | null {
  const raw = new URLSearchParams(search).get("kind");
  if (raw && VALID_RUNS_KINDS.has(raw as RunsKind)) {
    return raw as RunsKind;
  }
  return null;
}

function parseSelectedResourceId(search: string): string | null {
  return new URLSearchParams(search).get("resource");
}

const SIDEBAR_STORAGE_KEY = "dbt-tools.sidebarCollapsed";

function getInitialSidebarCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    // ignore
  }
  return true;
}

function isNavigationTargetActive(
  target: SidebarNavigationTarget,
  activeView: WorkspaceView,
  assetViewState: AssetViewState,
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

function getActiveNavigationItem(
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

function buildWorkspaceSignals(
  analysis: AnalysisState,
  analysisSource: "preload" | "upload" | null,
) {
  const attentionCount = analysis.executions.filter(
    (row) => row.statusTone === "danger",
  ).length;
  const warningCount = analysis.executions.filter(
    (row) => row.statusTone === "warning",
  ).length;
  const totalTests = analysis.executions.filter((row) =>
    ["test", "unit_test"].includes(row.resourceType),
  ).length;
  const documentedResources = analysis.resources.filter((resource) =>
    Boolean(resource.description?.trim()),
  ).length;
  const documentationCoverage =
    analysis.resources.length > 0
      ? Math.round((documentedResources / analysis.resources.length) * 100)
      : 0;

  return [
    {
      label: "Run posture",
      value:
        attentionCount > 0
          ? `${attentionCount} failing`
          : warningCount > 0
            ? `${warningCount} warning`
            : "Healthy",
      detail:
        attentionCount > 0
          ? "Prioritize failing nodes before reviewing downstream impact."
          : warningCount > 0
            ? "Warnings detected; review tests and exposures next."
            : "No failing nodes surfaced in this run.",
      tone:
        attentionCount > 0
          ? "danger"
          : warningCount > 0
            ? "warning"
            : "positive",
    },
    {
      label: "Metadata coverage",
      value: `${documentationCoverage}%`,
      detail: `${documentedResources} of ${analysis.resources.length} resources include descriptions for catalog-style discovery.`,
      tone:
        documentationCoverage >= 70
          ? "positive"
          : documentationCoverage >= 35
            ? "warning"
            : "neutral",
    },
    {
      label: "Workspace mode",
      value: analysisSource === "preload" ? "Live target" : "Artifact upload",
      detail:
        analysisSource === "preload"
          ? `Synced from DBT_TARGET with ${analysis.graphSummary.totalEdges} dependency edges ready for investigation.`
          : `${analysis.summary.total_nodes} executions loaded from local artifacts${totalTests > 0 ? `, including ${totalTests} tests` : ""}.`,
      tone: "neutral",
    },
  ] as const;
}

function AppSidebar({
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

// ─── Loading card ────────────────────────────────────────────────────────────

function LoadingCard() {
  return (
    <div className="loading-card">
      <Skeleton className="loading-card__skeleton-icon" />
      <div>
        <Skeleton className="loading-card__skeleton-title" />
        <Skeleton className="loading-card__skeleton-body" />
      </div>
    </div>
  );
}

// ─── Inner app (consumes ToastContext) ───────────────────────────────────────

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

  // Filter / view state for the workspace
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
  });

  // Persist sidebar collapsed state to localStorage
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

  // Listen for popstate (back/forward) to sync URL -> state
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

  // Track previous analysis to detect first-load transition
  const prevAnalysisRef = useRef<AnalysisState | null>(null);

  // Toast when the workspace auto-loads from a preloaded DBT_TARGET
  useEffect(() => {
    if (analysis && !prevAnalysisRef.current && analysisSource === "preload") {
      toast(
        `Workspace loaded — ${analysis.summary.total_nodes} executions`,
        "positive",
      );
    }
    prevAnalysisRef.current = analysis;
  }, [analysis, analysisSource, toast]);

  // Close the mobile sidebar on Escape
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
      {/* Backdrop — dismisses the mobile overlay sidebar */}
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
          {/* Hamburger — only visible at ≤ 639px via CSS */}
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

// ─── Root export ─────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
