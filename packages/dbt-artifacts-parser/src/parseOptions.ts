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
