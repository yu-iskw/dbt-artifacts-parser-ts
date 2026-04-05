export function popcount32(value: number): number {
  let current = value >>> 0;
  let count = 0;
  while (current !== 0) {
    current &= current - 1;
    count++;
  }
  return count;
}

export function createBitset(words: number): Uint32Array {
  return new Uint32Array(words);
}

export function unionIntoBitset(
  target: Uint32Array,
  source: Uint32Array,
): void {
  for (let index = 0; index < target.length; index++) {
    target[index] |= source[index];
  }
}

export function setBit(bitset: Uint32Array, index: number): void {
  const word = index >>> 5;
  const offset = index & 31;
  bitset[word] |= 1 << offset;
}

export function countBits(bitset: Uint32Array): number {
  let count = 0;
  for (const word of bitset) {
    count += popcount32(word);
  }
  return count;
}

export function countBitsetIntersection(
  a: Uint32Array,
  b: Uint32Array,
): number {
  let count = 0;
  for (let index = 0; index < a.length; index++) {
    count += popcount32(a[index]! & b[index]!);
  }
  return count;
}

export function countSetIntersection(a: Set<number>, b: Set<number>): number {
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  let count = 0;
  for (const value of smaller) {
    if (larger.has(value)) {
      count++;
    }
  }
  return count;
}
