import { useState } from "react";
import { analyzeArtifacts } from "../services/analyze";
import type { AnalysisState } from "../types";

interface FileUploadProps {
  onAnalysis: (analysis: AnalysisState) => void;
  onError: (error: string | null) => void;
}

async function readFileAsJson(file: File): Promise<Record<string, unknown>> {
  const text = await file.text();
  return JSON.parse(text) as Record<string, unknown>;
}

interface FileInputRowProps {
  id: string;
  label: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

function FileInputRow({ id, label, file, onFileChange }: FileInputRowProps) {
  return (
    <div>
      <label
        htmlFor={id}
        style={{ display: "block", marginBottom: "0.25rem", fontSize: 14 }}
      >
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept=".json"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        style={{ fontSize: 14 }}
      />
      {file && (
        <span style={{ marginLeft: "0.5rem", fontSize: 12, color: "#666" }}>
          {file.name}
        </span>
      )}
    </div>
  );
}

export function FileUpload({ onAnalysis, onError }: FileUploadProps) {
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [runResultsFile, setRunResultsFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAnalyze() {
    if (!manifestFile || !runResultsFile) {
      onError("Please select both manifest.json and run_results.json");
      return;
    }

    setLoading(true);
    onError(null);

    try {
      const [manifestJson, runResultsJson] = await Promise.all([
        readFileAsJson(manifestFile),
        readFileAsJson(runResultsFile),
      ]);
      const analysis = await analyzeArtifacts(manifestJson, runResultsJson);
      onAnalysis(analysis);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to parse artifacts");
    } finally {
      setLoading(false);
    }
  }

  const canAnalyze = manifestFile && runResultsFile && !loading;

  return (
    <div style={{ marginBottom: "2rem" }}>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <FileInputRow
          id="manifest-input"
          label="manifest.json"
          file={manifestFile}
          onFileChange={setManifestFile}
        />
        <FileInputRow
          id="run-results-input"
          label="run_results.json"
          file={runResultsFile}
          onFileChange={setRunResultsFile}
        />
      </div>
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={!canAnalyze}
        style={{
          padding: "0.5rem 1rem",
          fontSize: 14,
          cursor: canAnalyze ? "pointer" : "not-allowed",
          opacity: canAnalyze ? 1 : 0.6,
        }}
      >
        {loading ? "Analyzing…" : "Analyze"}
      </button>
    </div>
  );
}
