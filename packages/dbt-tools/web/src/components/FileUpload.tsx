import { useState } from "react";
import { analyzeArtifacts } from "../services/analyze";
import type { AnalysisState } from "../types";
import { Spinner } from "./Spinner";
import { useToast } from "./Toast";

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
    <div className="file-input-card">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        accept=".json"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
      {file && <span className="file-input-card__filename">{file.name}</span>}
    </div>
  );
}

export function FileUpload({ onAnalysis, onError }: FileUploadProps) {
  const { toast } = useToast();
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
      toast(
        `Analyzed ${analysis.summary.total_nodes} executions successfully`,
        "positive",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to parse artifacts";
      onError(message);
      toast(`Parse failed — ${message}`, "danger");
    } finally {
      setLoading(false);
    }
  }

  const canAnalyze = manifestFile && runResultsFile && !loading;

  return (
    <section className="upload-hero">
      <div className="upload-hero__copy">
        <p className="eyebrow">Bring your artifacts</p>
        <h2>Open a polished run workspace from local dbt outputs.</h2>
        <p>
          Load a matching <code>manifest.json</code> and{" "}
          <code>run_results.json</code> pair to inspect execution health,
          bottlenecks, dependencies, and timing in one place.
        </p>
      </div>

      <div className="upload-panel">
        <div className="upload-panel__inputs">
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
          className="primary-action"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          {loading && <Spinner size={16} />}
          {loading ? "Analyzing…" : "Analyze artifacts"}
        </button>
      </div>
    </section>
  );
}
