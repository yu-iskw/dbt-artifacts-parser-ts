import { topologicalSort, hasCycle } from "graphology-dag";
import type { ManifestGraph } from "./manifest-graph";
import type { NodeExecution } from "./execution-analyzer";

/** Resource types excluded from parallelism analysis (non-executable). */
const EXCLUDED_RESOURCE_TYPES = new Set(["field", "macro", "function"]);

/**
 * A single topological execution wave.
 * Nodes within a wave have no dependencies on each other and can run
 * fully in parallel (up to the thread limit).
 */
export interface ExecutionWave {
  wave_number: number;
  /** Unique IDs of nodes belonging to this wave. */
  node_ids: string[];
  /** Number of nodes that can run concurrently in this wave. */
  width: number;
  /**
   * Maximum observed execution time among nodes in the wave (seconds).
   * Present only when `nodeExecutions` is supplied to `analyzeParallelism`.
   */
  estimated_time_s?: number;
}

/**
 * A wave of width 1 that immediately follows a wider wave, forcing
 * serialization of the pipeline at that point.
 */
export interface SerializationBottleneck {
  wave_number: number;
  node_id: string;
  /** Human-readable description of the bottleneck. */
  description: string;
}

/**
 * Result of wave-based parallelism analysis.
 */
export interface ParallelismAnalysis {
  /** Topological waves in execution order. */
  waves: ExecutionWave[];
  total_waves: number;
  /** Widest wave (maximum nodes that could run concurrently). */
  max_parallelism: number;
  /** Mean wave width across all waves. */
  avg_wave_width: number;
  /** Waves of width 1 that follow wider waves — pipeline serialization points. */
  serialization_bottlenecks: SerializationBottleneck[];
  /**
   * Suggested `threads` setting: 75th-percentile wave width.
   * Covers most waves without over-provisioning for outlier-wide waves.
   */
  recommended_threads: number;
  /** True when the graph contains cycles (analysis cannot be performed). */
  has_cycles: boolean;
}

/**
 * Compute topological wave numbers using longest-path assignment.
 *
 * Each node's wave = max(wave of all analyzable parents) + 1.
 * Root nodes (no analyzable parents) are assigned wave 0.
 *
 * The input `sorted` must be in topological order.
 */
function computeWaveMap(
  sorted: string[],
  analyzableNodes: Set<string>,
  graph: ManifestGraph,
): Map<string, number> {
  const g = graph.getGraph();
  const waveMap = new Map<string, number>();

  for (const nodeId of sorted) {
    const analyzableParents = g
      .inboundNeighbors(nodeId)
      .filter((p) => analyzableNodes.has(p));

    if (analyzableParents.length === 0) {
      waveMap.set(nodeId, 0);
    } else {
      const maxParentWave = Math.max(
        ...analyzableParents.map((p) => waveMap.get(p) ?? 0),
      );
      waveMap.set(nodeId, maxParentWave + 1);
    }
  }

  return waveMap;
}

/** Build an optional lookup from unique_id → execution_time. */
function buildExecTimeMap(
  nodeExecutions?: NodeExecution[],
): Map<string, number> {
  const map = new Map<string, number>();
  if (nodeExecutions) {
    for (const exec of nodeExecutions) {
      map.set(exec.unique_id, exec.execution_time ?? 0);
    }
  }
  return map;
}

/** Collect analyzable node IDs (excludes field, macro, function). */
function collectAnalyzableNodes(
  g: ReturnType<ManifestGraph["getGraph"]>,
): Set<string> {
  const nodes = new Set<string>();
  g.forEachNode((nodeId, attrs) => {
    if (!EXCLUDED_RESOURCE_TYPES.has(attrs.resource_type as string)) {
      nodes.add(nodeId);
    }
  });
  return nodes;
}

/** Group node IDs by their computed wave number. */
function groupNodesByWave(waveMap: Map<string, number>): Map<number, string[]> {
  const groups = new Map<number, string[]>();
  for (const [nodeId, wave] of waveMap.entries()) {
    const bucket = groups.get(wave);
    if (bucket) {
      bucket.push(nodeId);
    } else {
      groups.set(wave, [nodeId]);
    }
  }
  return groups;
}

/** Build the ExecutionWave array from wave groups with optional timing. */
function buildWavesFromGroups(
  waveGroups: Map<number, string[]>,
  execTimeMap: Map<string, number>,
): ExecutionWave[] {
  const maxWave = waveGroups.size > 0 ? Math.max(...waveGroups.keys()) : -1;
  const waves: ExecutionWave[] = [];

  for (let w = 0; w <= maxWave; w++) {
    const nodeIds = waveGroups.get(w) ?? [];
    const wave: ExecutionWave = { wave_number: w, node_ids: nodeIds, width: nodeIds.length };

    if (execTimeMap.size > 0) {
      const times = nodeIds.map((id) => execTimeMap.get(id) ?? 0).filter((t) => t > 0);
      if (times.length > 0) {
        wave.estimated_time_s = Math.round(Math.max(...times) * 100) / 100;
      }
    }

    waves.push(wave);
  }

  return waves;
}

/** Find waves of width 1 that immediately follow a wider wave. */
function findSerializationBottlenecks(
  waves: ExecutionWave[],
  g: ReturnType<ManifestGraph["getGraph"]>,
): SerializationBottleneck[] {
  const bottlenecks: SerializationBottleneck[] = [];
  for (let i = 1; i < waves.length; i++) {
    const prev = waves[i - 1];
    const curr = waves[i];
    if (curr.width === 1 && prev.width > 1) {
      const nodeId = curr.node_ids[0];
      const attrs = g.hasNode(nodeId) ? g.getNodeAttributes(nodeId) : undefined;
      const name = attrs?.name ?? nodeId;
      bottlenecks.push({
        wave_number: curr.wave_number,
        node_id: nodeId,
        description: `"${name}" serializes ${prev.width} parallel nodes (wave ${prev.wave_number})`,
      });
    }
  }
  return bottlenecks;
}

/** 75th-percentile wave width as recommended thread count (min 1). */
function computeRecommendedThreads(
  waves: ExecutionWave[],
  maxParallelism: number,
): number {
  const sorted = waves.map((w) => w.width).sort((a, b) => a - b);
  const p75Idx = Math.min(Math.floor(sorted.length * 0.75), sorted.length - 1);
  return Math.max(1, sorted[p75Idx] ?? maxParallelism);
}

/** Shared empty result for early-return paths. */
function emptyResult(hasCycles: boolean): ParallelismAnalysis {
  return {
    waves: [],
    total_waves: 0,
    max_parallelism: 0,
    avg_wave_width: 0,
    serialization_bottlenecks: [],
    recommended_threads: 1,
    has_cycles: hasCycles,
  };
}

/**
 * Analyze execution parallelism from the dependency graph using topological
 * wave decomposition.
 *
 * Works from the manifest graph alone; `nodeExecutions` is optional and used
 * only to annotate each wave with observed execution times.
 */
export function analyzeParallelism(
  graph: ManifestGraph,
  nodeExecutions?: NodeExecution[],
): ParallelismAnalysis {
  const g = graph.getGraph();

  if (hasCycle(g)) {
    return emptyResult(true);
  }

  const execTimeMap = buildExecTimeMap(nodeExecutions);
  const analyzableNodes = collectAnalyzableNodes(g);

  if (analyzableNodes.size === 0) {
    return emptyResult(false);
  }

  const sorted = topologicalSort(g).filter((id) => analyzableNodes.has(id));
  const waveMap = computeWaveMap(sorted, analyzableNodes, graph);
  const waveGroups = groupNodesByWave(waveMap);
  const waves = buildWavesFromGroups(waveGroups, execTimeMap);

  const maxParallelism = waves.reduce((max, w) => Math.max(max, w.width), 0);
  const avgWaveWidth =
    waves.length > 0
      ? Math.round((waves.reduce((sum, w) => sum + w.width, 0) / waves.length) * 10) / 10
      : 0;

  return {
    waves,
    total_waves: waves.length,
    max_parallelism: maxParallelism,
    avg_wave_width: avgWaveWidth,
    serialization_bottlenecks: findSerializationBottlenecks(waves, g),
    recommended_threads: computeRecommendedThreads(waves, maxParallelism),
    has_cycles: false,
  };
}
