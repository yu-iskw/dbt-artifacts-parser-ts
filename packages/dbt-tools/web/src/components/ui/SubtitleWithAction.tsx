import { getThemeHex } from "@web/constants/themeColors";
import { useSyncedDocumentTheme } from "@web/hooks/useTheme";

interface SubtitleWithActionProps {
  hasAnalysis: boolean;
  onLoadDifferent: () => void;
}

export function SubtitleWithAction({
  hasAnalysis,
  onLoadDifferent,
}: SubtitleWithActionProps) {
  const theme = useSyncedDocumentTheme();
  const t = getThemeHex(theme);

  return (
    <p style={{ color: t.textSoft, marginBottom: "1.5rem" }}>
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
            color: t.accent,
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
