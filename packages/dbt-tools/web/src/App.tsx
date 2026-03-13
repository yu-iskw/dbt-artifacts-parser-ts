import { useEffect, useRef, useState } from "react";
import { analyzeArtifacts } from "./analyze";
import { debug } from "./debug";
import { FileUpload } from "./components/FileUpload";
import { GanttChart } from "./components/GanttChart";
import { RunSummary } from "./components/RunSummary";
import type { AnalysisState } from "./types";

function SubtitleWithAction({
  hasAnalysis,
  onLoadDifferent,
}: {
  hasAnalysis: boolean;
  onLoadDifferent: () => void;
}) {
  return (
    <p style={{ color: "#666", marginBottom: "1.5rem" }}>
      {hasAnalysis
        ? "Analysis ready. "
        : "Upload manifest.json and run_results.json to analyze your dbt run"}
      {hasAnalysis && (
        <button
          type="button"
          onClick={onLoadDifferent}
          style={{
            background: "none",
            border: "none",
            color: "#06c",
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
            marginLeft: "0.25rem",
          }}
        >
          Load different artifacts
        </button>
      )}
    </p>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "1rem",
        background: "#fee",
        border: "1px solid #c00",
        borderRadius: 8,
        marginBottom: "1rem",
      }}
    >
      {message}
    </div>
  );
}

function App() {
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preloadLoading, setPreloadLoading] = useState(true);
  const preloadAttempted = useRef(false);

  useEffect(() => {
    if (preloadAttempted.current) return;
    preloadAttempted.current = true;

    debug("Preload: fetching /api/manifest.json and /api/run_results.json");

    Promise.all([fetch("/api/manifest.json"), fetch("/api/run_results.json")])
      .then(([manifestRes, runResultsRes]) => {
        debug(
          "Preload: manifest status=",
          manifestRes.status,
          "ok=",
          manifestRes.ok,
          "run_results status=",
          runResultsRes.status,
          "ok=",
          runResultsRes.ok,
        );
        if (!manifestRes.ok || !runResultsRes.ok) {
          debug(
            "Preload: fallback to upload UI. Reason: one or both fetches failed",
          );
          setPreloadLoading(false);
          return;
        }
        return Promise.all([
          manifestRes.json() as Promise<Record<string, unknown>>,
          runResultsRes.json() as Promise<Record<string, unknown>>,
        ]).then(([manifestJson, runResultsJson]) =>
          analyzeArtifacts(manifestJson, runResultsJson),
        );
      })
      .then((result) => {
        setPreloadLoading(false);
        if (result) {
          debug("Preload: success, analysis loaded");
          setAnalysis(result);
          setError(null);
        }
      })
      .catch((err) => {
        setPreloadLoading(false);
        debug("Preload: error", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load artifacts from server",
        );
      });
  }, []);

  return (
    <div style={{ padding: "1rem 2rem", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>dbt-tools</h1>
      <SubtitleWithAction
        hasAnalysis={!!analysis}
        onLoadDifferent={() => {
          setAnalysis(null);
          setError(null);
        }}
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
        <FileUpload onAnalysis={setAnalysis} onError={setError} />
      )}
    </div>
  );
}

export default App;
