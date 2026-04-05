import { describe, expect, it } from "vitest";
import {
  logSumExp,
  normalizeArray,
  normalizeSparseArray,
} from "./graph-risk-math";

describe("graph-risk-math", () => {
  describe("normalizeArray", () => {
    it("returns empty for empty input", () => {
      expect(normalizeArray([])).toEqual([]);
    });

    it("returns zeros when all values are non-finite", () => {
      expect(
        normalizeArray([
          NaN,
          Number.POSITIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
        ]),
      ).toEqual([0, 0, 0]);
    });

    it("returns zeros when only one finite value (constant range)", () => {
      expect(normalizeArray([42])).toEqual([0]);
      expect(normalizeArray([1, 1, 1])).toEqual([0, 0, 0]);
    });

    it("linearly maps finite min..max to 0..100 (clamped scores)", () => {
      expect(normalizeArray([0, 10])).toEqual([0, 100]);
    });

    it("handles large arrays without spread-based min/max crashes", () => {
      const len = 25_000;
      const values = Array.from({ length: len }, (_, i) => i);
      expect(() => normalizeArray(values)).not.toThrow();
      const out = normalizeArray(values);
      expect(out[0]).toBe(0);
      expect(out[len - 1]).toBe(100);
    });
  });

  describe("normalizeSparseArray", () => {
    it("returns all undefined when no finite values exist", () => {
      expect(normalizeSparseArray([undefined, undefined])).toEqual([
        undefined,
        undefined,
      ]);
      expect(normalizeSparseArray([undefined, NaN])).toEqual([
        undefined,
        undefined,
      ]);
    });

    it("preserves undefined slots while normalizing finite entries", () => {
      expect(normalizeSparseArray([undefined, 5, 10])).toEqual([
        undefined,
        0,
        100,
      ]);
    });

    it("handles large sparse arrays without spread crashes", () => {
      const len = 25_000;
      const values: Array<number | undefined> = Array.from(
        { length: len },
        (_, i) => (i % 2 === 0 ? i : undefined),
      );
      expect(() => normalizeSparseArray(values)).not.toThrow();
      const out = normalizeSparseArray(values);
      expect(out[len - 2]).toBe(100);
    });
  });

  describe("logSumExp", () => {
    it("returns negative infinity for empty input", () => {
      expect(logSumExp([])).toBe(Number.NEGATIVE_INFINITY);
    });

    it("returns finite result for large inputs without spread max crash", () => {
      const values = Array.from(
        { length: 20_000 },
        (_, i) => Math.log(i + 1) * 0.01,
      );
      expect(() => logSumExp(values)).not.toThrow();
      expect(Number.isFinite(logSumExp(values))).toBe(true);
    });

    it("matches pairwise max semantics for non-finite pivots", () => {
      expect(Number.isNaN(logSumExp([1, NaN]))).toBe(true);
      expect(logSumExp([1, Number.POSITIVE_INFINITY])).toBe(
        Number.POSITIVE_INFINITY,
      );
    });
  });
});
