import { useRef, useState } from "react";
import { analyzeArtifacts } from "../services/analyze";
import type { AnalysisState } from "../types";
import { FileIcon, UploadIcon } from "./Icons";
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

interface FileSlotProps {
  id: string;
  label: string;
  hint: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

function FileSlot({ id, label, hint, file, onFileChange }: FileSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFileChange(dropped);
  }

  const slotClass = [
    "file-slot",
    dragOver ? "file-slot--drag-over" : "",
    file ? "file-slot--filled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={slotClass}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      aria-label={`${label} — ${file ? file.name : "click or drop to select"}`}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept=".json"
        className="file-slot__input"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        onClick={(e) => e.stopPropagation()}
        aria-label={label}
      />
      {file ? (
        <FileIcon size={22} className="file-slot__icon" />
      ) : (
        <UploadIcon size={22} className="file-slot__icon" />
      )}
      <span className="file-slot__label">{label}</span>
      {file ? (
        <span className="file-slot__filename">{file.name}</span>
      ) : (
        <span className="file-slot__hint">{hint}</span>
      )}
    </div>
  );
}

export function FileUpload({ onAnalysis, onError }: FileUploadProps) {
  const { toast } = useToast();
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [runResultsFile, setRunResultsFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * When a file is dropped on the hero area itself (outside any slot),
   * try to auto-assign based on filename.
   */
  function handleHeroDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      const name = file.name.toLowerCase();
      if (name.includes("manifest")) {
        setManifestFile(file);
      } else if (name.includes("run_results") || name.includes("run-results")) {
        setRunResultsFile(file);
      }
    }
  }

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
    <section
      className="upload-hero"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleHeroDrop}
    >
      <div className="upload-hero__copy">
        <p className="eyebrow">Bring your artifacts</p>
        <h2>Open a polished run workspace from local dbt outputs.</h2>
        <p>
          Load a matching <code>manifest.json</code> and{" "}
          <code>run_results.json</code> pair to inspect execution health,
          bottlenecks, dependencies, and timing in one place.
        </p>
        <p
          style={{
            fontSize: "0.88rem",
            color: "var(--text-soft)",
            marginTop: "0.25rem",
          }}
        >
          Drag both files anywhere on this card, or click each slot below.
        </p>
      </div>

      <div className="upload-panel">
        <div className="upload-panel__inputs">
          <FileSlot
            id="manifest-input"
            label="manifest.json"
            hint="Click or drag to select"
            file={manifestFile}
            onFileChange={setManifestFile}
          />
          <FileSlot
            id="run-results-input"
            label="run_results.json"
            hint="Click or drag to select"
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
