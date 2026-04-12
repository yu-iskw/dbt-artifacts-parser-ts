import { useMemo, useState } from "react";
import { Spinner } from "./ui/Spinner";
import { useToast } from "./ui/Toast";
import type { AnalysisLoadResult } from "../services/analysisLoader";
import {
  discoverArtifactCandidates,
  loadDiscoveredArtifactCandidate,
  refetchFromApi,
  type ArtifactDiscoveryResponse,
  type DiscoverSourceType,
} from "@web/services/artifactApi";

interface FileUploadProps {
  onAnalysis: (result: AnalysisLoadResult) => void;
  onError: (error: string | null) => void;
}

const SOURCE_OPTIONS: ReadonlyArray<{
  value: DiscoverSourceType;
  label: string;
}> = [
  { value: "local", label: "Local directory" },
  { value: "s3", label: "S3 prefix (s3://bucket/prefix)" },
  { value: "gcs", label: "GCS prefix (gcs://bucket/prefix)" },
];

export function FileUpload({ onAnalysis, onError }: FileUploadProps) {
  const { toast } = useToast();
  const [sourceType, setSourceType] = useState<DiscoverSourceType>("local");
  const [location, setLocation] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [discovery, setDiscovery] = useState<ArtifactDiscoveryResponse | null>(
    null,
  );
  const [discovering, setDiscovering] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedCandidate = useMemo(
    () =>
      discovery?.candidates.find(
        (candidate) => candidate.candidateId === selectedCandidateId,
      ) ?? null,
    [discovery, selectedCandidateId],
  );

  async function handleDiscover() {
    setDiscovering(true);
    onError(null);
    try {
      const result = await discoverArtifactCandidates({ sourceType, location });
      setDiscovery(result);
      const defaultCandidate = result.candidates[0]?.candidateId ?? "";
      setSelectedCandidateId(defaultCandidate);
      if (result.candidates.length === 0) {
        onError("No supported dbt artifacts were discovered at this location.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to discover artifacts";
      onError(message);
      toast(message, "danger");
    } finally {
      setDiscovering(false);
    }
  }

  async function handleLoad() {
    if (selectedCandidateId.trim() === "") {
      onError("Select a candidate artifact set before loading.");
      return;
    }

    setLoading(true);
    onError(null);
    try {
      await loadDiscoveredArtifactCandidate({
        sourceType,
        location,
        candidateId: selectedCandidateId,
      });

      const loaded = await refetchFromApi(
        sourceType === "local" ? "preload" : "remote",
      );
      if (loaded == null) {
        throw new Error("Artifacts were selected but could not be loaded.");
      }

      onAnalysis(loaded);

      const warningCount = selectedCandidate?.warnings.length ?? 0;
      toast(
        warningCount > 0
          ? `Loaded with ${warningCount} optional artifact warning${warningCount === 1 ? "" : "s"}`
          : `Loaded ${selectedCandidateId}`,
        warningCount > 0 ? "warning" : "positive",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load artifacts";
      onError(message);
      toast(message, "danger");
    } finally {
      setLoading(false);
    }
  }

  const requiresExplicitSelection = (discovery?.candidates.length ?? 0) > 1;

  return (
    <section className="upload-hero">
      <div className="upload-hero__copy">
        <p className="eyebrow">Artifact source</p>
        <h2>Load dbt artifacts from one directory or object-storage prefix.</h2>
        <p>
          Select a source type, provide a single location, discover candidate
          artifact sets, and explicitly choose which set to load.
        </p>
      </div>

      <div className="upload-panel">
        <div className="upload-panel__inputs">
          <label>
            Source type
            <select
              value={sourceType}
              onChange={(event) =>
                setSourceType(event.target.value as DiscoverSourceType)
              }
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Location
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder={
                sourceType === "local"
                  ? "/path/to/target"
                  : `${sourceType}://bucket/path/to/prefix`
              }
            />
          </label>

          <button
            type="button"
            className="primary-action"
            onClick={() => void handleDiscover()}
            disabled={discovering || loading}
          >
            {discovering ? <Spinner size={16} /> : null}
            {discovering ? "Discovering…" : "Discover artifact sets"}
          </button>

          {discovery != null && discovery.candidates.length > 0 ? (
            <>
              <label>
                Candidate set
                <select
                  value={selectedCandidateId}
                  onChange={(event) =>
                    setSelectedCandidateId(event.target.value)
                  }
                >
                  {discovery.candidates.map((candidate) => (
                    <option
                      key={candidate.candidateId}
                      value={candidate.candidateId}
                    >
                      {candidate.label}
                    </option>
                  ))}
                </select>
              </label>

              {requiresExplicitSelection ? (
                <p>
                  Multiple candidates found. Selection is required before
                  loading.
                </p>
              ) : null}

              {selectedCandidate?.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}

              <button
                type="button"
                className="primary-action"
                onClick={() => void handleLoad()}
                disabled={
                  loading ||
                  discovering ||
                  selectedCandidate == null ||
                  !selectedCandidate.isLoadable
                }
              >
                {loading ? <Spinner size={16} /> : null}
                {loading ? "Loading…" : "Load selected artifacts"}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
