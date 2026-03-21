interface SubtitleWithActionProps {
  hasAnalysis: boolean;
  onLoadDifferent: () => void;
}

export function SubtitleWithAction({
  hasAnalysis,
  onLoadDifferent,
}: SubtitleWithActionProps) {
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
