/**
 * CLI / URL strings aligned with `dbt-tools discover` and `view=discover&q=`.
 */

export function buildDiscoverCliCommand(query: string): string {
  const t = query.trim();
  return `dbt-tools discover ${JSON.stringify(t)} --json`;
}

/** Merge discover view + optional `q` into a page URL (typically `window.location.href`). */
export function buildDiscoverPageUrl(pageHref: string, query: string): string {
  const u = new URL(pageHref);
  u.searchParams.set("view", "discover");
  const t = query.trim();
  if (t) {
    u.searchParams.set("q", t);
  } else {
    u.searchParams.delete("q");
  }
  return u.toString();
}
