import { useEffect, useState } from "react";
import { requestResourceCodeFromWorker } from "@web/services/analysisLoader";

export interface UseResourceCodeResult {
  compiledCode: string | null;
  rawCode: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches compiled/raw SQL for a resource from the analysis worker (manifest
 * graph), since bulk {@link AnalysisState.resources} omit code for scale.
 */
export function useResourceCode(
  uniqueId: string | null,
): UseResourceCodeResult {
  const [compiledCode, setCompiledCode] = useState<string | null>(null);
  const [rawCode, setRawCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uniqueId) {
      setCompiledCode(null);
      setRawCode(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void requestResourceCodeFromWorker(uniqueId)
      .then((payload) => {
        if (cancelled) return;
        setCompiledCode(payload.compiledCode);
        setRawCode(payload.rawCode);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCompiledCode(null);
        setRawCode(null);
        setError(err instanceof Error ? err.message : "Failed to load SQL");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uniqueId]);

  return { compiledCode, rawCode, loading, error };
}
