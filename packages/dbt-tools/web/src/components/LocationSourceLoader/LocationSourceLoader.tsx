/**
 * LocationSourceLoader — multi-step UI for directory/prefix-based artifact loading.
 * Replaces the file-by-file FileUpload component.
 *
 * Steps: source-type → location → discover → (select if multiple) → activate → load
 */
import { useCallback, useState } from "react";
import { Spinner } from "../ui/Spinner";
import { useToast } from "../ui/Toast";
import {
  discoverArtifactSource,
  activateArtifactSource,
  refetchFromApi,
  type ArtifactSourceType,
  type ArtifactCandidateSummary,
} from "../../services/artifactSourceApi";
import { getDisabledCapabilities } from "../../lib/artifactCapabilities";
import type { AnalysisLoadResult } from "../../services/analysisLoader";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocationSourceLoaderProps {
  onAnalysis: (result: AnalysisLoadResult) => void;
  onError: (error: string | null) => void;
}

type Step =
  | { kind: "source-select" }
  | { kind: "location-input"; sourceType: ArtifactSourceType }
  | {
      kind: "discovering";
      sourceType: ArtifactSourceType;
      location: string;
    }
  | {
      kind: "candidate-select";
      sourceType: ArtifactSourceType;
      location: string;
      candidates: ArtifactCandidateSummary[];
      selectedCandidateId: string;
    }
  | {
      kind: "activating";
      sourceType: ArtifactSourceType;
      location: string;
      candidateId: string;
    }
  | { kind: "error"; message: string; previousKind: Step["kind"] };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_TYPE_LABELS: Record<ArtifactSourceType, string> = {
  local: "Local filesystem",
  s3: "Amazon S3",
  gcs: "Google Cloud Storage",
};

const SOURCE_TYPE_PLACEHOLDERS: Record<ArtifactSourceType, string> = {
  local: "./target  or  /path/to/dbt/target",
  s3: "my-bucket/dbt/runs",
  gcs: "my-bucket/dbt/runs",
};

const SOURCE_TYPE_HINTS: Record<ArtifactSourceType, string> = {
  local:
    "Enter the directory that contains manifest.json and run_results.json.",
  s3: "Enter bucket/prefix. Server-side credentials from DBT_TOOLS_REMOTE_SOURCE are used automatically.",
  gcs: "Enter bucket/prefix. Server-side credentials from DBT_TOOLS_REMOTE_SOURCE are used automatically.",
};

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const KIND_SOURCE_SELECT = "source-select" as const;
const KIND_LOCATION_INPUT = "location-input" as const;
const KIND_CANDIDATE_SELECT = "candidate-select" as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="source-loader__back-btn" onClick={onClick}>
      ← Back
    </button>
  );
}

function SourceTypeSelector({
  onSelect,
}: {
  onSelect: (t: ArtifactSourceType) => void;
}) {
  const sourceTypes: ArtifactSourceType[] = ["local", "s3", "gcs"];
  return (
    <div className="source-loader__step">
      <p className="eyebrow">Step 1 of 3</p>
      <h3>Choose artifact source</h3>
      <p>
        Select where your dbt artifacts are stored. The server handles
        authentication for cloud sources.
      </p>
      <div className="source-loader__type-grid">
        {sourceTypes.map((t) => (
          <button
            key={t}
            type="button"
            className="source-loader__type-card"
            onClick={() => onSelect(t)}
          >
            <strong>{SOURCE_TYPE_LABELS[t]}</strong>
            <span className="source-loader__type-badge">
              {t.toUpperCase()}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LocationInput({
  sourceType,
  onDiscover,
  onBack,
}: {
  sourceType: ArtifactSourceType;
  onDiscover: (location: string) => void;
  onBack: () => void;
}) {
  const [location, setLocation] = useState("");
  const trimmed = location.trim();
  const focusRef = useCallback((el: HTMLInputElement | null) => {
    el?.focus();
  }, []);

  return (
    <div className="source-loader__step">
      <BackButton onClick={onBack} />
      <p className="eyebrow">Step 2 of 3</p>
      <h3>{SOURCE_TYPE_LABELS[sourceType]}</h3>
      <p>{SOURCE_TYPE_HINTS[sourceType]}</p>

      <div className="source-loader__location-row">
        <label htmlFor="source-location-input" className="source-loader__label">
          Location
        </label>
        <input
          id="source-location-input"
          ref={focusRef}
          type="text"
          className="source-loader__location-input"
          placeholder={SOURCE_TYPE_PLACEHOLDERS[sourceType]}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && trimmed) onDiscover(trimmed);
          }}
        />
      </div>

      <button
        type="button"
        className="primary-action"
        disabled={!trimmed}
        onClick={() => {
          if (trimmed) onDiscover(trimmed);
        }}
      >
        Discover artifacts
      </button>
    </div>
  );
}

function DiscoveringStep({ location }: { location: string }) {
  return (
    <div className="source-loader__step source-loader__step--centered">
      <Spinner size={32} />
      <p>Scanning {location}&hellip;</p>
    </div>
  );
}

function CandidateCard({
  candidate,
  selected,
  onSelect,
}: {
  candidate: ArtifactCandidateSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const disabled = getDisabledCapabilities(candidate.missingOptional);

  return (
    <button
      type="button"
      className={`source-loader__candidate-card${selected ? " source-loader__candidate-card--selected" : ""}`}
      onClick={onSelect}
    >
      <div className="source-loader__candidate-header">
        <strong>{candidate.label}</strong>
        <span className="source-loader__candidate-time">
          {formatTimestamp(candidate.updatedAtMs)}
        </span>
      </div>
      <div className="source-loader__candidate-badges">
        <span className="source-loader__badge source-loader__badge--present">
          manifest
        </span>
        <span className="source-loader__badge source-loader__badge--present">
          run_results
        </span>
        {candidate.hasCatalog ? (
          <span className="source-loader__badge source-loader__badge--present">
            catalog
          </span>
        ) : (
          <span className="source-loader__badge source-loader__badge--absent">
            no catalog
          </span>
        )}
        {candidate.hasSources ? (
          <span className="source-loader__badge source-loader__badge--present">
            sources
          </span>
        ) : (
          <span className="source-loader__badge source-loader__badge--absent">
            no sources
          </span>
        )}
      </div>
      {disabled.length > 0 && (
        <p className="source-loader__candidate-warning">
          Unavailable without optional artifacts:{" "}
          {disabled.map((c) => c.label).join(", ")}
        </p>
      )}
    </button>
  );
}

function CandidateSelector({
  sourceType,
  location,
  candidates,
  selectedCandidateId,
  onSelect,
  onLoad,
  onBack,
  activating,
}: {
  sourceType: ArtifactSourceType;
  location: string;
  candidates: ArtifactCandidateSummary[];
  selectedCandidateId: string;
  onSelect: (id: string) => void;
  onLoad: () => void;
  onBack: () => void;
  activating: boolean;
}) {
  return (
    <div className="source-loader__step">
      <BackButton onClick={onBack} />
      <p className="eyebrow">Step 3 of 3</p>
      <h3>Select artifact set</h3>
      <p>
        {candidates.length} candidate{candidates.length === 1 ? "" : "s"} found
        at{" "}
        <code>{location}</code>
        {sourceType !== "local" ? ` (${sourceType.toUpperCase()})` : ""}.
        Select the set to load.
      </p>
      <div className="source-loader__candidate-list">
        {candidates.map((c) => (
          <CandidateCard
            key={c.candidateId}
            candidate={c}
            selected={c.candidateId === selectedCandidateId}
            onSelect={() => onSelect(c.candidateId)}
          />
        ))}
      </div>

      <button
        type="button"
        className="primary-action"
        disabled={!selectedCandidateId || activating}
        onClick={onLoad}
        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
      >
        {activating && <Spinner size={16} />}
        {activating ? "Loading…" : "Load selected artifacts"}
      </button>
    </div>
  );
}

function ActivatingStep() {
  return (
    <div className="source-loader__step source-loader__step--centered">
      <Spinner size={32} />
      <p>Activating artifacts&hellip;</p>
    </div>
  );
}

function ErrorStep({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="source-loader__step">
      <div className="source-loader__error">
        <strong>Could not load artifacts</strong>
        <p>{message}</p>
      </div>
      <button type="button" className="primary-action" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LocationSourceLoader({
  onAnalysis,
  onError,
}: LocationSourceLoaderProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>({ kind: KIND_SOURCE_SELECT });

  async function runDiscover(
    sourceType: ArtifactSourceType,
    location: string,
  ) {
    setStep({ kind: "discovering", sourceType, location });
    try {
      const result = await discoverArtifactSource({ sourceType, location });

      if (result.error || result.candidates.length === 0) {
        const message =
          result.error ??
          "No artifact pair found. Ensure manifest.json and run_results.json are both present.";
        setStep({
          kind: "error",
          message,
          previousKind: KIND_LOCATION_INPUT,
        });
        onError(message);
        return;
      }

      if (result.candidates.length === 1) {
        // Single candidate — skip selection, go straight to activate.
        const candidate = result.candidates[0]!;
        await runActivate(sourceType, location, candidate.candidateId);
      } else {
        setStep({
          kind: KIND_CANDIDATE_SELECT,
          sourceType,
          location,
          candidates: result.candidates,
          selectedCandidateId: result.candidates[0]!.candidateId,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Discovery failed";
      setStep({ kind: "error", message, previousKind: KIND_LOCATION_INPUT });
      onError(message);
    }
  }

  async function runActivate(
    sourceType: ArtifactSourceType,
    location: string,
    candidateId: string,
  ) {
    setStep({ kind: "activating", sourceType, location, candidateId });
    try {
      await activateArtifactSource({ sourceType, location, candidateId });
      const result = await refetchFromApi("runtime");
      if (result == null) {
        throw new Error(
          "Artifacts were activated but could not be loaded from the server.",
        );
      }
      onError(null);
      onAnalysis(result);
      toast(
        `Loaded ${result.analysis.summary.total_nodes} executions`,
        "positive",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Activation failed";
      setStep({
        kind: "error",
        message,
        previousKind: KIND_CANDIDATE_SELECT,
      });
      onError(message);
    }
  }

  // Render

  if (step.kind === KIND_SOURCE_SELECT) {
    return (
      <section className="upload-hero">
        <div className="upload-hero__copy">
          <p className="eyebrow">Bring your artifacts</p>
          <h2>
            Review dbt runs like a modern control plane, not a raw JSON dump.
          </h2>
          <p>
            Point the workspace at a local directory or a cloud object-storage
            prefix that contains a matching <code>manifest.json</code> and{" "}
            <code>run_results.json</code> pair.
          </p>
        </div>

        <div className="upload-panel">
          <div className="upload-panel__header">
            <div>
              <p className="eyebrow">Artifact source</p>
              <h3>Open investigation workspace</h3>
            </div>
          </div>
          <div className="source-loader__inner">
            <SourceTypeSelector
              onSelect={(t) =>
                setStep({ kind: KIND_LOCATION_INPUT, sourceType: t })
              }
            />
          </div>
        </div>
      </section>
    );
  }

  if (step.kind === KIND_LOCATION_INPUT) {
    return (
      <section className="upload-hero">
        <div className="upload-hero__copy">
          <p className="eyebrow">Bring your artifacts</p>
          <h2>Specify the artifact location</h2>
          <p>
            Enter the directory or prefix where dbt wrote its output. Both{" "}
            <code>manifest.json</code> and <code>run_results.json</code> must be
            present.
          </p>
        </div>
        <div className="upload-panel">
          <div className="source-loader__inner">
            <LocationInput
              sourceType={step.sourceType}
              onDiscover={(location) => {
                void runDiscover(step.sourceType, location);
              }}
              onBack={() => setStep({ kind: KIND_SOURCE_SELECT })}
            />
          </div>
        </div>
      </section>
    );
  }

  if (step.kind === "discovering") {
    return (
      <section className="upload-hero">
        <div className="upload-hero__copy">
          <p className="eyebrow">Scanning</p>
          <h2>Looking for artifacts&hellip;</h2>
        </div>
        <div className="upload-panel">
          <div className="source-loader__inner">
            <DiscoveringStep location={step.location} />
          </div>
        </div>
      </section>
    );
  }

  if (step.kind === KIND_CANDIDATE_SELECT) {
    return (
      <section className="upload-hero">
        <div className="upload-hero__copy">
          <p className="eyebrow">Multiple runs found</p>
          <h2>Choose a run to load</h2>
          <p>
            Multiple complete artifact sets were discovered. Select one to open
            in the workspace.
          </p>
        </div>
        <div className="upload-panel">
          <div className="source-loader__inner">
            <CandidateSelector
              sourceType={step.sourceType}
              location={step.location}
              candidates={step.candidates}
              selectedCandidateId={step.selectedCandidateId}
              onSelect={(id) =>
                setStep({ ...step, selectedCandidateId: id })
              }
              onLoad={() => {
                void runActivate(
                  step.sourceType,
                  step.location,
                  step.selectedCandidateId,
                );
              }}
              onBack={() =>
                setStep({
                  kind: KIND_LOCATION_INPUT,
                  sourceType: step.sourceType,
                })
              }
              activating={false}
            />
          </div>
        </div>
      </section>
    );
  }

  if (step.kind === "activating") {
    return (
      <section className="upload-hero">
        <div className="upload-hero__copy">
          <p className="eyebrow">Loading</p>
          <h2>Opening workspace&hellip;</h2>
        </div>
        <div className="upload-panel">
          <div className="source-loader__inner">
            <ActivatingStep />
          </div>
        </div>
      </section>
    );
  }

  // error
  return (
    <section className="upload-hero">
      <div className="upload-hero__copy">
        <p className="eyebrow">Artifact source</p>
        <h2>Could not load artifacts</h2>
      </div>
      <div className="upload-panel">
        <div className="source-loader__inner">
          <ErrorStep
            message={step.message}
            onRetry={() => setStep({ kind: KIND_SOURCE_SELECT })}
          />
        </div>
      </div>
    </section>
  );
}
