import { useEffect, useRef } from "react";
import type { WorkspaceSignal } from "./components/AnalysisWorkspace";
import { AppWorkspaceChrome } from "./components/AppShell/AppWorkspaceChrome";
import { buildWorkspaceSignals } from "./components/AppShell/workspaceSignals";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { useAnalysisPage } from "./hooks/useAnalysisPage";
import { useTheme } from "./hooks/useTheme";
import { useWorkspaceUrlState } from "./hooks/useWorkspaceUrlState";
import type { AnalysisState } from "@web/types";

function AppContent() {
  const { toast } = useToast();
  const workspace = useWorkspaceUrlState();
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

  const workspaceSignals: WorkspaceSignal[] = analysis
    ? (buildWorkspaceSignals(
        analysis,
        analysisSource,
      ) as unknown as WorkspaceSignal[])
    : [];

  return (
    <AppWorkspaceChrome
      workspace={workspace}
      analysis={analysis}
      analysisSource={analysisSource}
      error={error}
      preloadLoading={preloadLoading}
      onLoadDifferent={onLoadDifferent}
      onAnalysis={onAnalysis}
      onError={onError}
      theme={theme}
      toggleTheme={toggleTheme}
      workspaceSignals={workspaceSignals}
    />
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
