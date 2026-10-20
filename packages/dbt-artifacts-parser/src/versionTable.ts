import type { ParseOptions } from "./parseOptions";

export type VersionSlot<T> = {
  readonly version: number;
  readonly parse: (parsed: Record<string, unknown>) => T;
  readonly cast: (parsed: Record<string, unknown>) => T;
};

/**
 * Slots keyed by the integer in `metadata.dbt_schema_version`.
 * `maxVersion` is the greatest key, including 0 when that is the only slot.
 */
export class VersionTable<T> {
  readonly maxVersion: number;
  private readonly byVersion: ReadonlyMap<number, VersionSlot<T>>;

  private constructor(
    maxVersion: number,
    byVersion: ReadonlyMap<number, VersionSlot<T>>,
  ) {
    this.maxVersion = maxVersion;
    this.byVersion = byVersion;
  }

  static create<U>(slots: readonly VersionSlot<U>[]): VersionTable<U> {
    if (slots.length === 0) {
      throw new Error("Version table requires at least one slot");
    }
    const byVersion = new Map<number, VersionSlot<U>>();
    let maxVersion = -1;
    for (const entry of slots) {
      if (!Number.isInteger(entry.version) || entry.version < 0) {
        throw new Error(
          `Version must be a non-negative integer, got ${entry.version}`,
        );
      }
      if (byVersion.has(entry.version)) {
        throw new Error(`Duplicate version ${entry.version}`);
      }
      byVersion.set(entry.version, entry);
      if (entry.version > maxVersion) {
        maxVersion = entry.version;
      }
    }
    return new VersionTable(maxVersion, byVersion);
  }

  get(version: number): VersionSlot<T> | undefined {
    return this.byVersion.get(version);
  }

  latest(): VersionSlot<T> {
    return this.require(this.maxVersion);
  }

  exact(version: number): (parsed: Record<string, unknown>) => T {
    return this.require(version).parse;
  }

  private require(version: number): VersionSlot<T> {
    const found = this.byVersion.get(version);
    if (found === undefined) {
      throw new Error(`No slot for version ${version}`);
    }
    return found;
  }
}

export function versionTable<T>(
  slots: readonly VersionSlot<T>[],
): VersionTable<T> {
  return VersionTable.create(slots);
}

export function identityCast<T>(): (parsed: Record<string, unknown>) => T {
  return (parsed) => parsed as unknown as T;
}

export function slot<T>(spec: {
  version: number;
  exactFragment: string;
  mismatch: string;
  cast: (parsed: Record<string, unknown>) => T;
}): VersionSlot<T> {
  return {
    version: spec.version,
    cast: spec.cast,
    parse(parsed) {
      const url = schemaUrl(parsed);
      if (url === undefined || !url.includes(spec.exactFragment)) {
        throw new Error(spec.mismatch);
      }
      return spec.cast(parsed);
    },
  };
}

/**
 * The table stores the category union, so an exact parser restores its own version type here.
 */
export function typedExact<TSpecific, TTable>(
  table: VersionTable<TTable>,
  version: number,
): (parsed: Record<string, unknown>) => TSpecific {
  const parse = table.exact(version);
  return (parsed) => parse(parsed) as unknown as TSpecific;
}

export function parseByVersion<T>(args: {
  table: VersionTable<T>;
  schemaPattern: RegExp;
  notArtifactMessage: string;
  unsupportedLabel: string;
  parsed: Record<string, unknown>;
  options?: ParseOptions;
}): T {
  const url = schemaUrl(args.parsed);
  if (url === undefined) {
    throw new Error(args.notArtifactMessage);
  }
  const match = url.match(args.schemaPattern);
  if (match === null) {
    throw new Error(args.notArtifactMessage);
  }
  const version = parseInt(match[1], 10);
  const found = args.table.get(version);
  if (found !== undefined) {
    return found.parse(args.parsed);
  }
  const fallback = tryFallbackToLatest(
    args.table,
    args.parsed,
    version,
    url,
    args.options,
  );
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Unsupported ${args.unsupportedLabel} version: ${version}`);
}

function schemaUrl(parsed: Record<string, unknown>): string | undefined {
  const metadata = parsed.metadata;
  if (typeof metadata !== "object" || metadata === null) {
    return undefined;
  }
  const value = (metadata as Record<string, unknown>).dbt_schema_version;
  return typeof value === "string" ? value : undefined;
}

function warnFallbackToLatest(requested: string, parsedAs: string): void {
  console.warn(
    `Unsupported artifact schema version '${requested}'; ` +
      `falling back to latest supported schema '${parsedAs}'. ` +
      "This is best-effort; prefer refreshing parsers for full support.",
  );
}

function tryFallbackToLatest<T>(
  table: VersionTable<T>,
  parsed: Record<string, unknown>,
  version: number,
  schemaVersion: string,
  options: ParseOptions | undefined,
): T | undefined {
  if (!options?.fallbackToLatest || version <= table.maxVersion) {
    return undefined;
  }
  warnFallbackToLatest(schemaVersion, `v${table.maxVersion}`);
  // A newer URL does not include the latest fragment, so this uses cast, not parse.
  return table.latest().cast(parsed);
}
