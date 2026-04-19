/**
 * CLI / URL strings aligned with `dbt-tools discover` and Inventory `view=inventory&q=`.
 */

export function buildDiscoverCliCommand(query: string): string {
  const t = query.trim();
  return `dbt-tools discover ${JSON.stringify(t)} --json`;
}

/** Merge Inventory view + optional `q` into a page URL (typically `window.location.href`). */
export function buildDiscoverPageUrl(pageHref: string, query: string): string {
  const u = new URL(pageHref);
  u.searchParams.set("view", "inventory");
  const t = query.trim();
  if (t) {
    u.searchParams.set("q", t);
  } else {
    u.searchParams.delete("q");
  }
  return u.toString();
}
