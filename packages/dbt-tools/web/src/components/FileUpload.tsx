import { useMemo, useState } from "react";
import { analyzeArtifacts } from "../services/analyze";
import type { AnalysisState } from "@web/types";
import { Spinner } from "./ui/Spinner";
import { useToast } from "./ui/Toast";

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

const WORKSPACE_FEATURES = [
  {
    title: "Health-first overview",
    body: "Spot failing nodes, long-running bottlenecks, and critical-path pressure before opening individual assets.",
  },
  {
    title: "Catalog-style context",
    body: "Browse lineage-adjacent metadata such as descriptions, packages, execution status, and dependency depth in one flow.",
  },
  {
    title: "Timeline investigation",
    body: "Shift from summary to execution sequencing without leaving the workspace, inspired by dbt docs and observability tools.",
  },
] as const;

export function FileUpload({ onAnalysis, onError }: FileUploadProps) {
  const { toast } = useToast();
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [runResultsFile, setRunResultsFile] = useState<File | null>(null);
  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAnalyze() {
    if (!manifestFile || !runResultsFile) {
      onError("Please select both manifest.json and run_results.json");
      return;
    }

    setLoading(true);
    onError(null);

    try {
      const [manifestJson, runResultsJson, catalogJson] = await Promise.all([
        readFileAsJson(manifestFile),
        readFileAsJson(runResultsFile),
        catalogFile ? readFileAsJson(catalogFile) : Promise.resolve(undefined),
      ]);
      const analysis = await analyzeArtifacts(
        manifestJson,
        runResultsJson,
        catalogJson,
      );
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
  const readinessLabel = useMemo(() => {
    if (manifestFile && runResultsFile) return "Ready to analyze";
    if (manifestFile || runResultsFile) return "Waiting for one more file";
    return "Add both dbt artifacts to continue";
  }, [manifestFile, runResultsFile]);

  return (
    <section className="upload-hero">
      <div className="upload-hero__copy">
        <p className="eyebrow">Bring your artifacts</p>
        <h2>
          Review dbt runs like a modern control plane, not a raw JSON dump.
        </h2>
        <p>
          Start from the two artifacts that power <code>dbt docs</code> and most
          run analysis workflows: a matching <code>manifest.json</code> and
          <code> run_results.json</code> pair.
        </p>

        <div className="upload-hero__callout">
          <span className="upload-hero__callout-badge">Recommended flow</span>
          <strong>
            Run <code>dbt docs generate</code> after a representative job.
          </strong>
          <p>
            That keeps lineage, metadata, and runtime results aligned so the
            workspace can feel closer to dbt Docs for discovery and closer to
            Elementary for health triage.
          </p>
        </div>

        <div className="upload-feature-grid">
          {WORKSPACE_FEATURES.map((feature) => (
            <article key={feature.title} className="upload-feature-card">
              <strong>{feature.title}</strong>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="upload-panel">
        <div className="upload-panel__header">
          <div>
            <p className="eyebrow">Artifact intake</p>
            <h3>Open investigation workspace</h3>
          </div>
          <span className="upload-panel__status">{readinessLabel}</span>
        </div>

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
          <FileInputRow
            id="catalog-input"
            label="catalog.json (optional)"
            file={catalogFile}
            onFileChange={setCatalogFile}
          />
        </div>

        <div className="upload-panel__tips">
          <div>
            <strong>Best when files come from the same run.</strong>
            <span>
              Mismatched manifests and run results usually surface missing nodes
              or stale timings.
            </span>
          </div>
          <div>
            <strong>Use local outputs or DBT_TARGET.</strong>
            <span>
              The app supports both uploaded artifacts and auto-loaded local
              targets for faster iteration.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void handleAnalyze();
          }}
          disabled={!canAnalyze}
          className="primary-action"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
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
