import { ErrorBanner } from "./components/ErrorBanner";
import { FileUpload } from "./components/FileUpload";
import { GanttChart } from "./components/GanttChart";
import { RunSummary } from "./components/RunSummary";
import { SubtitleWithAction } from "./components/SubtitleWithAction";
import { useAnalysisPage } from "./hooks/useAnalysisPage";

function App() {
  const {
    analysis,
    error,
    preloadLoading,
    onLoadDifferent,
    onAnalysis,
    onError,
  } = useAnalysisPage();

  return (
    <div style={{ padding: "1rem 2rem", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>dbt-tools</h1>
      <SubtitleWithAction
        hasAnalysis={!!analysis}
        onLoadDifferent={onLoadDifferent}
      />

      {error && <ErrorBanner message={error} />}

      {analysis && (
        <>
          <RunSummary
            summary={analysis.summary}
            bottlenecks={analysis.bottlenecks}
          />
          <GanttChart data={analysis.ganttData} />
        </>
      )}

      {preloadLoading && !analysis && (
        <p style={{ color: "#666" }}>Loading artifacts...</p>
      )}
      {!preloadLoading && !analysis && (
        <FileUpload onAnalysis={onAnalysis} onError={onError} />
      )}
    </div>
  );
}

export default App;
