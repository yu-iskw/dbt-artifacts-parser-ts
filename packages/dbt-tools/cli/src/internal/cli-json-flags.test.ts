import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolveJsonEnvelopeRequested,
  shouldOutputJsonForCli,
} from "./cli-json-flags";

describe("cli-json-flags", () => {
  const prev = process.env.DBT_TOOLS_JSON_ENVELOPE;

  beforeEach(() => {
    delete process.env.DBT_TOOLS_JSON_ENVELOPE;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.DBT_TOOLS_JSON_ENVELOPE;
    else process.env.DBT_TOOLS_JSON_ENVELOPE = prev;
  });

  describe("resolveJsonEnvelopeRequested", () => {
    it("should return true when flag is true", () => {
      expect(resolveJsonEnvelopeRequested({ jsonEnvelope: true })).toBe(true);
    });

    it("should read DBT_TOOLS_JSON_ENVELOPE", () => {
      process.env.DBT_TOOLS_JSON_ENVELOPE = "1";
      expect(resolveJsonEnvelopeRequested({})).toBe(true);
      process.env.DBT_TOOLS_JSON_ENVELOPE = "TRUE";
      expect(resolveJsonEnvelopeRequested({})).toBe(true);
    });

    it("should return false when unset and flag false", () => {
      expect(resolveJsonEnvelopeRequested({ jsonEnvelope: false })).toBe(false);
      expect(resolveJsonEnvelopeRequested({})).toBe(false);
    });
  });

  describe("shouldOutputJsonForCli", () => {
    it("matches explicit --json / --no-json semantics", () => {
      expect(shouldOutputJsonForCli(true, undefined)).toBe(true);
      expect(shouldOutputJsonForCli(undefined, true)).toBe(false);
    });
  });
});
