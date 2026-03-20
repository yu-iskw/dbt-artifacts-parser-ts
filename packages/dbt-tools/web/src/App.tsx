import { useEffect, useRef, useState } from "react";
import {
  AnalysisWorkspace,
  type WorkspaceView,
} from "./components/AnalysisWorkspace";
import { ErrorBanner } from "./components/ErrorBanner";
import { FileUpload } from "./components/FileUpload";
import { Skeleton } from "./components/Skeleton";
import { ToastProvider, useToast } from "./components/Toast";
import { useAnalysisPage } from "./hooks/useAnalysisPage";
import type { AnalysisState } from "./types";

const navigationItems: Array<{
  view: WorkspaceView;
  label: string;
  description: string;
  abbr: string;
  icon: string;
}> = [
  {
    view: "overview",
    label: "Overview",
    description: "Run health and bottlenecks",
    abbr: "Ov",
    icon: "◫",
  },
  {
    view: "assets",
    label: "Assets",
    description: "Manifest resource explorer",
    abbr: "As",
    icon: "◧",
  },
  {
    view: "models",
    label: "Models",
    description: "Model, seed, snapshot runs",
    abbr: "Mo",
    icon: "◩",
  },
  {
    view: "tests",
    label: "Tests",
    description: "Test pass / fail results",
    abbr: "Te",
    icon: "◪",
  },
  {
    view: "timeline",
    label: "Timeline",
    description: "Runtime sequencing",
    abbr: "Ti",
    icon: "◬",
  },
];

function getViewCount(
  view: WorkspaceView,
  analysis: AnalysisState | null,
): string | null {
  if (!analysis) return null;
  if (view === "overview") return `${analysis.summary.total_nodes}`;
  if (view === "assets") return `${analysis.resources.length}`;
  if (view === "models") {
    return `${analysis.executions.filter((row) => !["test", "unit_test"].includes(row.resourceType)).length}`;
  }
  if (view === "tests") {
    return `${analysis.executions.filter((row) => ["test", "unit_test"].includes(row.resourceType)).length}`;
  }
  return `${analysis.ganttData.length}`;
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
  setActiveView,
  sidebarCollapsed,
  setSidebarCollapsed,
  onNavigate,
  analysis,
  analysisSource,
}: {
  activeView: WorkspaceView;
  setActiveView: (v: WorkspaceView) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (fn: (c: boolean) => boolean) => void;
  /** Called after any navigation action so the parent can close the mobile overlay. */
  onNavigate: () => void;
  analysis: AnalysisState | null;
  analysisSource: "preload" | "upload" | null;
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
          setActiveView("overview");
          onNavigate();
        }}
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
              onClick={() => {
                setActiveView(item.view);
                onNavigate();
              }}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className="sidebar-link__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="sidebar-link__abbr" aria-hidden="true">
                {item.abbr}
              </span>
              <div className="sidebar-link__body">
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </div>
              {getViewCount(item.view, analysis) && (
                <span className="sidebar-link__count">
                  {getViewCount(item.view, analysis)}
                </span>
              )}
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

const VIEW_TITLES: Record<WorkspaceView, string> = {
  overview: "Workspace overview",
  assets: "Asset investigation",
  models: "Model results",
  tests: "Test results",
  timeline: "Execution timeline",
};

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
  const [activeView, setActiveView] = useState<WorkspaceView>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Track previous analysis to detect first-load transition
  const prevAnalysisRef = useRef<AnalysisState | null>(null);

  useEffect(() => {
    if (!analysis) setActiveView("overview");
  }, [analysis]);

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

  const workspaceTitle = VIEW_TITLES[activeView];
  const workspaceSignals = analysis
    ? buildWorkspaceSignals(analysis, analysisSource)
    : [];
  const workspaceSummary = analysis
    ? `${analysis.graphSummary.totalNodes} nodes · ${analysis.summary.total_nodes} executions · ${analysisSource === "preload" ? "Auto-loaded from DBT_TARGET" : "Loaded from uploaded artifacts"}`
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
        setActiveView={setActiveView}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        onNavigate={() => setSidebarOpen(false)}
        analysis={analysis}
        analysisSource={analysisSource}
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
          <AnalysisWorkspace analysis={analysis} activeView={activeView} />
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
