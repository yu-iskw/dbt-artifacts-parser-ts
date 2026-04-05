import type {
  AnalysisNode,
  ReachabilityCollection,
  ReachabilityState,
} from "./graph-risk-analysis-types";
import {
  createBitset,
  unionIntoBitset,
  setBit,
  countBits,
  countBitsetIntersection,
  countSetIntersection,
} from "./graph-risk-bitset";

export function buildReachabilityState(
  nodes: AnalysisNode[],
  topoOrder: number[],
  maxExactStructuralNodes: number,
): ReachabilityState {
  const useBitsets = nodes.length <= maxExactStructuralNodes;
  const words = Math.ceil(nodes.length / 32);
  const ancestors = createReachabilityCollections(
    nodes.length,
    useBitsets,
    words,
  );
  const descendants = createReachabilityCollections(
    nodes.length,
    useBitsets,
    words,
  );
  const ancestorCounts = new Array<number>(nodes.length).fill(0);
  const descendantCounts = new Array<number>(nodes.length).fill(0);

  if (useBitsets) {
    populateAncestorBitsets(nodes, topoOrder, ancestors, ancestorCounts);
    populateDescendantBitsets(nodes, topoOrder, descendants, descendantCounts);
  } else {
    populateAncestorSets(nodes, topoOrder, ancestors, ancestorCounts);
    populateDescendantSets(nodes, topoOrder, descendants, descendantCounts);
  }

  return {
    useBitsets,
    ancestors,
    descendants,
    ancestorCounts,
    descendantCounts,
  };
}

function createReachabilityCollections(
  count: number,
  useBitsets: boolean,
  words: number,
): ReachabilityCollection[] {
  return Array.from({ length: count }, () =>
    useBitsets ? createBitset(words) : new Set<number>(),
  );
}

function populateAncestorBitsets(
  nodes: AnalysisNode[],
  topoOrder: number[],
  ancestors: ReachabilityCollection[],
  ancestorCounts: number[],
): void {
  for (const nodeIndex of topoOrder) {
    const current = ancestors[nodeIndex] as Uint32Array;
    for (const parentIndex of nodes[nodeIndex]!.parents) {
      unionIntoBitset(current, ancestors[parentIndex] as Uint32Array);
      setBit(current, parentIndex);
    }
    ancestorCounts[nodeIndex] = countBits(current);
  }
}

function populateDescendantBitsets(
  nodes: AnalysisNode[],
  topoOrder: number[],
  descendants: ReachabilityCollection[],
  descendantCounts: number[],
): void {
  for (let position = topoOrder.length - 1; position >= 0; position--) {
    const nodeIndex = topoOrder[position]!;
    const current = descendants[nodeIndex] as Uint32Array;
    for (const childIndex of nodes[nodeIndex]!.children) {
      unionIntoBitset(current, descendants[childIndex] as Uint32Array);
      setBit(current, childIndex);
    }
    descendantCounts[nodeIndex] = countBits(current);
  }
}

function populateAncestorSets(
  nodes: AnalysisNode[],
  topoOrder: number[],
  ancestors: ReachabilityCollection[],
  ancestorCounts: number[],
): void {
  for (const nodeIndex of topoOrder) {
    const current = ancestors[nodeIndex] as Set<number>;
    for (const parentIndex of nodes[nodeIndex]!.parents) {
      current.add(parentIndex);
      for (const ancestor of ancestors[parentIndex] as Set<number>) {
        current.add(ancestor);
      }
    }
    ancestorCounts[nodeIndex] = current.size;
  }
}

function populateDescendantSets(
  nodes: AnalysisNode[],
  topoOrder: number[],
  descendants: ReachabilityCollection[],
  descendantCounts: number[],
): void {
  for (let position = topoOrder.length - 1; position >= 0; position--) {
    const nodeIndex = topoOrder[position]!;
    const current = descendants[nodeIndex] as Set<number>;
    for (const childIndex of nodes[nodeIndex]!.children) {
      current.add(childIndex);
      for (const descendant of descendants[childIndex] as Set<number>) {
        current.add(descendant);
      }
    }
    descendantCounts[nodeIndex] = current.size;
  }
}

function countOverlapRatio(
  reachability: ReachabilityState,
  leftIndex: number,
  rightIndex: number,
): number {
  const leftCount = reachability.ancestorCounts[leftIndex]!;
  const rightCount = reachability.ancestorCounts[rightIndex]!;

  if (reachability.useBitsets) {
    const intersection = countBitsetIntersection(
      reachability.ancestors[leftIndex] as Uint32Array,
      reachability.ancestors[rightIndex] as Uint32Array,
    );
    const union = leftCount + rightCount - intersection;
    return union <= 0 ? 0 : intersection / union;
  }

  const intersection = countSetIntersection(
    reachability.ancestors[leftIndex] as Set<number>,
    reachability.ancestors[rightIndex] as Set<number>,
  );
  const union = leftCount + rightCount - intersection;
  return union <= 0 ? 0 : intersection / union;
}

export function computeReconvergenceRaw(
  nodes: AnalysisNode[],
  reachability: ReachabilityState,
): number[] {
  const scores = new Array<number>(nodes.length).fill(0);

  for (const node of nodes) {
    if (node.parents.length < 2) {
      continue;
    }

    let pairCount = 0;
    let overlapTotal = 0;
    for (let left = 0; left < node.parents.length; left++) {
      for (let right = left + 1; right < node.parents.length; right++) {
        overlapTotal += countOverlapRatio(
          reachability,
          node.parents[left]!,
          node.parents[right]!,
        );
        pairCount++;
      }
    }

    const averagePairwiseOverlap = pairCount > 0 ? overlapTotal / pairCount : 0;
    const averageParentBreadth =
      node.parents.reduce(
        (sum, parentIndex) => sum + reachability.ancestorCounts[parentIndex]!,
        0,
      ) / node.parents.length;

    scores[node.index] =
      averagePairwiseOverlap * 2 +
      Math.log1p(averageParentBreadth) * 0.75 +
      Math.log1p(node.parents.length - 1) * 0.5;
  }

  return scores;
}
