export function roundNumber(value: number, digits = 2): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > 100) return 100;
  return roundNumber(value);
}

function minMaxFinite(values: number[]): { min: number; max: number } {
  let min = values[0]!;
  let max = values[0]!;
  for (let i = 1; i < values.length; i++) {
    const v = values[i]!;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  return { min, max };
}

export function normalizeArray(values: number[]): number[] {
  if (values.length === 0) {
    return [];
  }

  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) {
    return values.map(() => 0);
  }

  const { min, max } = minMaxFinite(finiteValues);
  if (max <= min) {
    return values.map(() => 0);
  }

  return values.map((value) => clampScore(((value - min) / (max - min)) * 100));
}

export function normalizeSparseArray(
  values: Array<number | undefined>,
): Array<number | undefined> {
  const finiteValues = values.filter(
    (value): value is number => value !== undefined && Number.isFinite(value),
  );
  if (finiteValues.length === 0) {
    return values.map(() => undefined);
  }

  const { min, max } = minMaxFinite(finiteValues);
  if (max <= min) {
    return values.map((value) => (value === undefined ? undefined : 0));
  }

  return values.map((value) =>
    value === undefined
      ? undefined
      : clampScore(((value - min) / (max - min)) * 100),
  );
}

export function logSumExp(values: number[]): number {
  if (values.length === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  let max = values[0]!;
  for (let i = 1; i < values.length; i++) {
    max = Math.max(max, values[i]!);
  }
  if (!Number.isFinite(max)) {
    return max;
  }

  let sum = 0;
  for (const value of values) {
    sum += Math.exp(value - max);
  }
  return max + Math.log(sum);
}

export function safeProbability(logValue: number): number {
  if (!Number.isFinite(logValue)) {
    return 0;
  }
  return Math.max(0, Math.min(1, Math.exp(logValue)));
}
