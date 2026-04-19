import type { DiscoverMatch, DiscoverOutput } from "@dbt-tools/core/browser";
import {
  buildDiscoverCliCommand,
  buildDiscoverPageUrl,
} from "@web/lib/analysis-workspace/discover-handoff";
import type {
  AssetTab,
  WorkspaceView,
} from "@web/lib/analysis-workspace/types";
import { discoverResourcesFromWorker } from "@web/services/analysisLoader";
import type { AnalysisState } from "@web/types";
import { useCallback, useEffect, useRef, useState } from "react";

export interface DiscoverWorkspaceViewProps {
  analysis: AnalysisState;
  query: string;
  onQueryChange: (next: string) => void;
  onNavigateTo: (
    view: WorkspaceView,
    options?: {
      resourceId?: string;
      assetTab?: AssetTab;
      rootResourceId?: string;
    },
  ) => void;
}

export function DiscoverWorkspaceView({
  analysis: _analysis,
  query,
  onQueryChange,
  onNavigateTo,
}: DiscoverWorkspaceViewProps) {
  void _analysis;
  const [output, setOutput] = useState<DiscoverOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<"cli" | "url" | null>(null);
  const copyHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runDiscover = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setOutput(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const o = await discoverResourcesFromWorker(trimmed, 50);
      setOutput(o);
    } catch (e) {
      setOutput(null);
      setError(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runDiscover(query);
  }, [query, runDiscover]);

  useEffect(() => {
    return () => {
      if (copyHintTimer.current != null) {
        clearTimeout(copyHintTimer.current);
      }
    };
  }, []);

  const showCopyHint = useCallback((kind: "cli" | "url") => {
    setCopyHint(kind);
    if (copyHintTimer.current != null) {
      clearTimeout(copyHintTimer.current);
    }
    copyHintTimer.current = setTimeout(() => {
      setCopyHint(null);
      copyHintTimer.current = null;
    }, 2000);
  }, []);

  const onCopyCli = useCallback(async () => {
    const cmd = buildDiscoverCliCommand(query);
    try {
      await navigator.clipboard.writeText(cmd);
      showCopyHint("cli");
    } catch {
      setError("Clipboard unavailable (copy CLI manually)");
    }
  }, [query, showCopyHint]);

  const onCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        buildDiscoverPageUrl(window.location.href, query),
      );
      showCopyHint("url");
    } catch {
      setError("Clipboard unavailable (copy URL manually)");
    }
  }, [query, showCopyHint]);

  return (
    <div className="discover-workspace">
      <header className="discover-workspace__header">
        <h1 className="discover-workspace__title">Discover</h1>
        <p className="discover-workspace__lede text-secondary">
          Ranked matches with reasons, related nodes, and suggested next steps
          (same ranking contract as{" "}
          <code className="discover-workspace__code">dbt-tools discover</code>).
        </p>
        <div className="discover-workspace__search-row">
          <input
            type="search"
            className="discover-workspace__input"
            placeholder="Search models, tests, sources…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Discovery query"
          />
        </div>
        <div className="discover-workspace__export-row">
          <button
            type="button"
            className="workspace-pill"
            disabled={!query.trim()}
            onClick={() => void onCopyCli()}
          >
            Copy CLI
          </button>
          <button
            type="button"
            className="workspace-pill"
            onClick={() => void onCopyUrl()}
          >
            Copy page URL
          </button>
          {copyHint === "cli" ? (
            <span className="discover-workspace__copy-hint text-secondary">
              Copied CLI command
            </span>
          ) : null}
          {copyHint === "url" ? (
            <span className="discover-workspace__copy-hint text-secondary">
              Copied URL
            </span>
          ) : null}
        </div>
      </header>
      {error != null ? (
        <p className="discover-workspace__error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="discover-workspace__status text-secondary">Searching…</p>
      ) : null}
      {!loading && output && output.matches.length === 0 && query.trim() ? (
        <p className="discover-workspace__empty text-secondary">No matches.</p>
      ) : null}
      {output && output.matches.length > 0 ? (
        <ul className="discover-workspace__results">
          {output.matches.map((m) => (
            <DiscoverMatchRow
              key={m.unique_id}
              match={m}
              onNavigateTo={onNavigateTo}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DiscoverMatchRow({
  match,
  onNavigateTo,
}: {
  match: DiscoverMatch;
  onNavigateTo: DiscoverWorkspaceViewProps["onNavigateTo"];
}) {
  return (
    <li className="discover-workspace__result">
      <div className="discover-workspace__result-main">
        <span className="discover-workspace__name">{match.display_name}</span>
        <span className="discover-workspace__meta text-secondary">
          {match.resource_type} · score {match.score} · {match.confidence}
        </span>
      </div>
      <div className="discover-workspace__chips" aria-label="Match reasons">
        {match.reasons.map((r) => (
          <span key={r} className="discover-workspace__chip">
            {r}
          </span>
        ))}
      </div>
      {match.disambiguation.length > 0 ? (
        <div className="discover-workspace__disambig text-secondary">
          Also named similarly:{" "}
          {match.disambiguation.map((d) => d.unique_id).join(", ")}
        </div>
      ) : null}
      {match.related.length > 0 ? (
        <div className="discover-workspace__related text-secondary">
          Related:{" "}
          {match.related.map((r) => `${r.relation}:${r.unique_id}`).join(" · ")}
        </div>
      ) : null}
      <div className="discover-workspace__actions">
        <button
          type="button"
          className="workspace-pill"
          onClick={() =>
            onNavigateTo("inventory", {
              resourceId: match.unique_id,
              assetTab: "summary",
              rootResourceId: match.unique_id,
            })
          }
        >
          Explain (summary)
        </button>
        <button
          type="button"
          className="workspace-pill"
          onClick={() =>
            onNavigateTo("inventory", {
              resourceId: match.unique_id,
              assetTab: "lineage",
              rootResourceId: match.unique_id,
            })
          }
        >
          Impact (lineage)
        </button>
        <button
          type="button"
          className="workspace-pill"
          onClick={() => onNavigateTo("runs", { resourceId: match.unique_id })}
        >
          Diagnose (runs)
        </button>
      </div>
    </li>
  );
}
