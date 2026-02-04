/**
 * FILE: src/features/architect/utils/entitlements/dare/swapGraph.ts
 * PURPOSE: Build swap dependency graph for cycle detection and deterministic ordering
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-04: Created for PST Phase 17.4.1 - Resolver-level swap graph ordering
 *
 * LINKS:
 *  - Master: docs/team-scrape/PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_MASTER.md
 *
 * KEY CONCEPTS:
 *  - Swap graph represents dependencies between teams for swap resolution
 *  - Cycle detection identifies circular swap chains (A↔B↔C↔A)
 *  - Deterministic ordering ensures stable resolution regardless of input order
 */

import type { EffectiveEntitlement } from '../entitlementResolver';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A node in the swap graph representing a team's participation in swaps.
 */
export interface SwapGraphNode {
  teamCode: string;
  /** Entitlement IDs where this team is the controller */
  controllerOf: string[];
  /** Entitlement IDs where this team is a target/pool member */
  targetIn: string[];
}

/**
 * An edge in the swap graph representing a swap relationship.
 */
export interface SwapGraphEdge {
  entitlementId: string;
  controllerTeam: string;
  targetTeams: string[];
}

/**
 * Result of building the swap graph.
 */
export interface SwapGraph {
  nodes: Map<string, SwapGraphNode>;
  edges: SwapGraphEdge[];
  /** Entitlements sorted in deterministic order */
  sortedEntitlementIds: string[];
  /** Entitlements by ID for quick lookup */
  entitlementsById: Map<string, EffectiveEntitlement>;
}

/**
 * Result of cycle detection.
 */
export interface CycleDetectionResult {
  hasCycles: boolean;
  /** All team codes that participate in cycles */
  cycleNodes: string[];
  /** All entitlement IDs that participate in cycles */
  cycleEntitlementIds: string[];
  /** Distinct cycles found (each cycle is an array of team codes) */
  cycles: string[][];
}

// =============================================================================
// GRAPH BUILDING
// =============================================================================

/**
 * Build a swap dependency graph from a set of swap entitlements.
 *
 * @param entitlements - Array of swap_right entitlements
 * @param draftYear - The draft year to filter for
 * @returns SwapGraph with nodes, edges, and sorted entitlement IDs
 */
export function buildSwapGraph(
  entitlements: EffectiveEntitlement[],
  draftYear: number
): SwapGraph {
  const nodes = new Map<string, SwapGraphNode>();
  const edges: SwapGraphEdge[] = [];
  const entitlementsById = new Map<string, EffectiveEntitlement>();

  // Filter to only swap_right entitlements for the target year
  const swapEntitlements = entitlements.filter(
    (ent) =>
      ent.kind === 'swap_right' &&
      ent.seasonYear === draftYear &&
      ent.resolved !== true
  );

  // Sort entitlements by ID for deterministic processing
  const sortedEntitlements = [...swapEntitlements].sort((a, b) =>
    (a.id as string).localeCompare(b.id as string)
  );

  for (const ent of sortedEntitlements) {
    const entId = ent.id as string;
    entitlementsById.set(entId, ent);

    const controllerTeam = parseTeamFromPickId(
      ent.swapControllerPickId as string
    );
    if (!controllerTeam) continue;

    // Get target teams from pool or single target
    const targetTeams = getSwapTargetTeams(ent, controllerTeam);

    // Create or update controller node
    if (!nodes.has(controllerTeam)) {
      nodes.set(controllerTeam, {
        teamCode: controllerTeam,
        controllerOf: [],
        targetIn: [],
      });
    }
    nodes.get(controllerTeam)!.controllerOf.push(entId);

    // Create or update target nodes
    for (const targetTeam of targetTeams) {
      if (!nodes.has(targetTeam)) {
        nodes.set(targetTeam, {
          teamCode: targetTeam,
          controllerOf: [],
          targetIn: [],
        });
      }
      nodes.get(targetTeam)!.targetIn.push(entId);
    }

    // Add edge
    edges.push({
      entitlementId: entId,
      controllerTeam,
      targetTeams,
    });
  }

  return {
    nodes,
    edges,
    sortedEntitlementIds: sortedEntitlements.map((e) => e.id as string),
    entitlementsById,
  };
}

// =============================================================================
// CYCLE DETECTION
// =============================================================================

/**
 * Detect cycles in the swap graph using DFS.
 *
 * A cycle exists when there's a path A → B → C → A through swap relationships.
 * For swaps, this means:
 * - A controls a swap with B
 * - B controls a swap with C
 * - C controls a swap with A
 *
 * @param graph - The swap graph to analyze
 * @returns CycleDetectionResult with cycle information
 */
export function detectSwapCycles(graph: SwapGraph): CycleDetectionResult {
  const { nodes, edges } = graph;

  if (edges.length === 0) {
    return {
      hasCycles: false,
      cycleNodes: [],
      cycleEntitlementIds: [],
      cycles: [],
    };
  }

  // Build adjacency list: controllerTeam → targetTeams[]
  const adjacency = new Map<string, Set<string>>();
  const edgesByController = new Map<string, SwapGraphEdge[]>();

  for (const edge of edges) {
    if (!adjacency.has(edge.controllerTeam)) {
      adjacency.set(edge.controllerTeam, new Set());
    }
    if (!edgesByController.has(edge.controllerTeam)) {
      edgesByController.set(edge.controllerTeam, []);
    }
    for (const target of edge.targetTeams) {
      adjacency.get(edge.controllerTeam)!.add(target);
    }
    edgesByController.get(edge.controllerTeam)!.push(edge);
  }

  // DFS for cycle detection
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycleNodes = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): boolean {
    if (recursionStack.has(node)) {
      // Found a cycle - extract cycle from path
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart);
        cycle.push(node); // Complete the cycle
        cycles.push(cycle);
        for (const n of cycle) {
          cycleNodes.add(n);
        }
      }
      return true;
    }

    if (visited.has(node)) {
      return false;
    }

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = adjacency.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        dfs(neighbor, [...path]);
      }
    }

    recursionStack.delete(node);
    return false;
  }

  // Start DFS from all controller nodes
  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  // Find all entitlements that participate in cycles
  const cycleEntitlementIds = new Set<string>();
  for (const edge of edges) {
    const involvesCycle =
      cycleNodes.has(edge.controllerTeam) &&
      edge.targetTeams.some((t) => cycleNodes.has(t));
    if (involvesCycle) {
      cycleEntitlementIds.add(edge.entitlementId);
    }
  }

  return {
    hasCycles: cycleNodes.size > 0,
    cycleNodes: [...cycleNodes].sort(),
    cycleEntitlementIds: [...cycleEntitlementIds].sort(),
    cycles,
  };
}

// =============================================================================
// DETERMINISTIC ORDERING
// =============================================================================

/**
 * Get a deterministic processing order for swap entitlements.
 *
 * The order is:
 * 1. Non-cyclical swaps first (in ID order within layers)
 * 2. Cyclical swaps last (they will be marked unchanged)
 *
 * @param graph - The swap graph
 * @param cycleResult - Result of cycle detection
 * @returns Ordered array of entitlement IDs
 */
export function getDeterministicSwapOrder(
  graph: SwapGraph,
  cycleResult: CycleDetectionResult
): string[] {
  const cyclicalIds = new Set(cycleResult.cycleEntitlementIds);

  // Split into non-cyclical and cyclical
  const nonCyclical = graph.sortedEntitlementIds.filter(
    (id) => !cyclicalIds.has(id)
  );
  const cyclical = graph.sortedEntitlementIds.filter((id) =>
    cyclicalIds.has(id)
  );

  // Non-cyclical first (already sorted by ID), then cyclical
  return [...nonCyclical, ...cyclical];
}

// =============================================================================
// PARSING HELPERS
// =============================================================================

/**
 * Parse team code from a pick ID like "LAL_2026_1st" → "LAL"
 */
function parseTeamFromPickId(pickId: string | undefined | null): string | null {
  if (!pickId || typeof pickId !== 'string') return null;
  const match = pickId.match(/^([A-Z]{3})_\d{4}_/);
  return match ? match[1] : null;
}

/**
 * Get all target teams from a swap entitlement.
 */
function getSwapTargetTeams(
  entitlement: EffectiveEntitlement,
  controllerTeam: string
): string[] {
  const targets: string[] = [];

  // Pool swap: multiple targets
  const poolPickIds = entitlement.poolUnderlyingPickIds as string[] | undefined;
  if (Array.isArray(poolPickIds) && poolPickIds.length > 0) {
    for (const pickId of poolPickIds) {
      const team = parseTeamFromPickId(pickId);
      if (team && team !== controllerTeam) {
        targets.push(team);
      }
    }
  }

  // Single target from swapTargetTeam field
  if (typeof entitlement.swapTargetTeam === 'string') {
    const team = entitlement.swapTargetTeam as string;
    if (team !== controllerTeam && !targets.includes(team)) {
      targets.push(team);
    }
  }

  // Parse from swapTargetDefinition
  if (typeof entitlement.swapTargetDefinition === 'string') {
    const def = entitlement.swapTargetDefinition as string;
    const swapWithMatch = def.match(/swap\s+with\s+([A-Z]{3})/i);
    if (swapWithMatch) {
      const team = swapWithMatch[1].toUpperCase();
      if (team !== controllerTeam && !targets.includes(team)) {
        targets.push(team);
      }
    }
  }

  // Fallback: parse from underlyingPickId
  if (
    targets.length === 0 &&
    typeof entitlement.underlyingPickId === 'string'
  ) {
    const team = parseTeamFromPickId(entitlement.underlyingPickId);
    if (team && team !== controllerTeam) {
      targets.push(team);
    }
  }

  return targets;
}

// =============================================================================
// EXPORTS FOR TESTING
// =============================================================================

export const _testExports = {
  parseTeamFromPickId,
  getSwapTargetTeams,
};
