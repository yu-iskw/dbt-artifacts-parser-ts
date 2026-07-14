/**
 * Options for auto-detecting artifact parse functions.
 */
export type ParseOptions = {
  /**
   * When true and the schema version is newer than supported, parse as the
   * latest known schema (best-effort). Default is false (strict).
   */
  fallbackToLatest?: boolean;
};

/**
 * Warn that an unsupported newer schema was parsed as the latest known version.
 */
function warnFallbackToLatest(requested: string, parsedAs: string): void {
  console.warn(
    `Unsupported artifact schema version '${requested}'; ` +
      `falling back to latest supported schema '${parsedAs}'. ` +
      "This is best-effort; prefer refreshing parsers for full support.",
  );
}

/**
 * When fallback applies, warn and return `value`; otherwise return undefined.
 */
export function tryFallbackToLatest<T>(
  options: ParseOptions | undefined,
  version: number,
  maxVersion: number,
  schemaVersion: string,
  value: T,
): T | undefined {
  if (!options?.fallbackToLatest || version <= maxVersion) {
    return undefined;
  }
  warnFallbackToLatest(schemaVersion, `v${maxVersion}`);
  return value;
}
