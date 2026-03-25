import { THEME_HEX } from "@web/constants/themeColors";

interface SubtitleWithActionProps {
  hasAnalysis: boolean;
  onLoadDifferent: () => void;
}

export function SubtitleWithAction({
  hasAnalysis,
  onLoadDifferent,
}: SubtitleWithActionProps) {
  return (
    <p style={{ color: THEME_HEX.textSoft, marginBottom: "1.5rem" }}>
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
            color: THEME_HEX.accent,
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
