/**
 * Canonical dbt-tools configuration via `DBT_TOOLS_*` environment variables.
 * Legacy `DBT_*` names remain supported with one-time deprecation warnings.
 */

const warnedDeprecatedKeys = new Set<string>();

/** @internal Vitest-only: clears deprecation warning deduplication. */
export function resetDbtToolsEnvDeprecationWarningsForTests(): void {
  warnedDeprecatedKeys.clear();
}

function warnDeprecatedOnce(legacyKey: string, canonicalKey: string): void {
  if (warnedDeprecatedKeys.has(legacyKey)) return;
  warnedDeprecatedKeys.add(legacyKey);
  console.warn(
    `[dbt-tools] The environment variable ${legacyKey} is deprecated; use ${canonicalKey} instead.`,
  );
}

function trimEnv(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t === "" ? undefined : t;
}

/**
 * Directory containing dbt artifacts (typically the dbt `target/` folder).
 * Precedence: `DBT_TOOLS_TARGET_DIR`, then `DBT_TARGET_DIR`, then `DBT_TARGET`.
 */
export function getDbtToolsTargetDirFromEnv(): string | undefined {
  const canon = trimEnv(process.env.DBT_TOOLS_TARGET_DIR);
  if (canon !== undefined) return canon;

  const dir = trimEnv(process.env.DBT_TARGET_DIR);
  if (dir !== undefined) {
    warnDeprecatedOnce("DBT_TARGET_DIR", "DBT_TOOLS_TARGET_DIR");
    return dir;
  }

  const target = trimEnv(process.env.DBT_TARGET);
  if (target !== undefined) {
    warnDeprecatedOnce("DBT_TARGET", "DBT_TOOLS_TARGET_DIR");
    return target;
  }

  return undefined;
}

/** Server-side debug logging when value is exactly `"1"`. */
export function isDbtToolsDebugEnabled(): boolean {
  const canon = process.env.DBT_TOOLS_DEBUG;
  if (canon !== undefined) {
    return canon === "1";
  }
  if (process.env.DBT_DEBUG === "1") {
    warnDeprecatedOnce("DBT_DEBUG", "DBT_TOOLS_DEBUG");
    return true;
  }
  return false;
}

/**
 * File watch + auto-reload (Vite dev). Disabled only when the active variable is `"0"`.
 * Default when unset: enabled (matches legacy `DBT_WATCH` semantics).
 */
export function isDbtToolsWatchEnabled(): boolean {
  const canon = process.env.DBT_TOOLS_WATCH;
  if (canon !== undefined) {
    return canon.trim() !== "0";
  }
  if (process.env.DBT_WATCH !== undefined) {
    warnDeprecatedOnce("DBT_WATCH", "DBT_TOOLS_WATCH");
    return process.env.DBT_WATCH.trim() !== "0";
  }
  return true;
}

const DEFAULT_RELOAD_DEBOUNCE_MS = 300;

function parseNonNegativeInt(raw: string): number {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_RELOAD_DEBOUNCE_MS;
}

/** Debounce for artifact reload notifications (ms). */
export function getDbtToolsReloadDebounceMs(): number {
  const canon = trimEnv(process.env.DBT_TOOLS_RELOAD_DEBOUNCE_MS);
  if (canon !== undefined) {
    return parseNonNegativeInt(canon);
  }
  const leg = trimEnv(process.env.DBT_RELOAD_DEBOUNCE_MS);
  if (leg !== undefined) {
    warnDeprecatedOnce(
      "DBT_RELOAD_DEBOUNCE_MS",
      "DBT_TOOLS_RELOAD_DEBOUNCE_MS",
    );
    return parseNonNegativeInt(leg);
  }
  return DEFAULT_RELOAD_DEBOUNCE_MS;
}
