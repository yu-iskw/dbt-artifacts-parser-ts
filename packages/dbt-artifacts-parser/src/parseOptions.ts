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
export function warnFallbackToLatest(
  requested: string,
  parsedAs: string,
): void {
  console.warn(
    `Unsupported artifact schema version '${requested}'; ` +
      `falling back to latest supported schema '${parsedAs}'. ` +
      "This is best-effort; prefer refreshing parsers for full support.",
  );
}
