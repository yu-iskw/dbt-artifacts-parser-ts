/**
 * Debug logging for the web app. Use `?debug=1` in the URL to enable.
 * For server logs (dbt-target plugin), use `DBT_DEBUG=1` when starting dev.
 */
const DEBUG =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("debug") === "1"
    : false;

export function debug(...args: unknown[]) {
  if (DEBUG) console.log("[dbt-tools]", ...args);
}
