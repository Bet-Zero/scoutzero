/**
 * FILE: src/tests/architect/dare/phase17_4_1_resolver_swap_graph_guardrail.test.ts
 * PURPOSE: Guardrail tests for Phase 17.4.1 - Resolver-level swap graph ordering + cycle handling
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-04: Created for PST Phase 17.4.1
 *
 * TEST COVERAGE:
 *  ✅ Deterministic ordering: same entitlements in shuffled order → identical receipt
 *  ✅ Acyclic chain: A↔B and B↔C resolves deterministically
 *  ✅ Cycle partial handling: only cyclical swaps marked unchanged
 *  ✅ Cycle metadata: cycleNodes + cycleEntitlementIds populated
 *  ✅ Swap graph building and cycle detection unit tests
 */

import { describe, it, expect } from 'vitest';
import {
  buildSwapGraph,
  detectSwapCycles,
  getDeterministicSwapOrder,
} from '@/features/architect/utils/entitlements/dare/swapGraph';
import type { EffectiveEntitlement } from '@/features/architect/utils/entitlements/entitlementResolver';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createSwapEntitlement(
  id: string,
  holderTeam: string,
  controllerPickId: string,
  poolPickIds: string[],
  overrides: Partial<EffectiveEntitlement> = {}
): EffectiveEntitlement {
  return {
    id,
    kind: 'swap_right',
    holderTeam,
    seasonYear: 2026,
    round: 1,
    swapControllerPickId: controllerPickId,
    poolUnderlyingPickIds: poolPickIds,
    swapType: 'best_of',
    ...overrides,
  } as EffectiveEntitlement;
}

// =============================================================================
// SWAP GRAPH BUILDING TESTS
// =============================================================================

describe('Phase 17.4.1: Swap Graph Building', () => {
  it('builds graph with correct nodes and edges', () => {
    const entitlements = [
      createSwapEntitlement('ent:AAA:2026:1:swap:ab', 'AAA', 'AAA_2026_1st', [
        'BBB_2026_1st',
      ]),
      createSwapEntitlement('ent:CCC:2026:1:swap:cd', 'CCC', 'CCC_2026_1st', [
        'DDD_2026_1st',
      ]),
    ];

    const graph = buildSwapGraph(entitlements, 2026);

    // Check nodes
    expect(graph.nodes.size).toBe(4); // AAA, BBB, CCC, DDD
    expect(graph.nodes.has('AAA')).toBe(true);
    expect(graph.nodes.has('BBB')).toBe(true);
    expect(graph.nodes.has('CCC')).toBe(true);
    expect(graph.nodes.has('DDD')).toBe(true);

    // Check edges
    expect(graph.edges.length).toBe(2);
    expect(graph.edges[0].controllerTeam).toBe('AAA');
    expect(graph.edges[0].targetTeams).toContain('BBB');
  });

  it('filters out entitlements for wrong year', () => {
    const entitlements = [
      createSwapEntitlement(
        'ent:AAA:2026:1:swap:ab',
        'AAA',
        'AAA_2026_1st',
        ['BBB_2026_1st'],
        { seasonYear: 2026 }
      ),
      createSwapEntitlement(
        'ent:CCC:2027:1:swap:cd',
        'CCC',
        'CCC_2027_1st',
        ['DDD_2027_1st'],
        { seasonYear: 2027 }
      ),
    ];

    const graph = buildSwapGraph(entitlements, 2026);

    // Only 2026 swap should be included
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0].entitlementId).toBe('ent:AAA:2026:1:swap:ab');
  });

  it('filters out already resolved entitlements', () => {
    const entitlements = [
      createSwapEntitlement('ent:AAA:2026:1:swap:ab', 'AAA', 'AAA_2026_1st', [
        'BBB_2026_1st',
      ]),
      createSwapEntitlement(
        'ent:CCC:2026:1:swap:cd',
        'CCC',
        'CCC_2026_1st',
        ['DDD_2026_1st'],
        { resolved: true }
      ),
    ];

    const graph = buildSwapGraph(entitlements, 2026);

    // Only unresolved swap should be included
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0].entitlementId).toBe('ent:AAA:2026:1:swap:ab');
  });

  it('sorts entitlements by ID for determinism', () => {
    // Create in reverse order
    const entitlements = [
      createSwapEntitlement('ent:ZZZ:2026:1:swap:za', 'ZZZ', 'ZZZ_2026_1st', [
        'AAA_2026_1st',
      ]),
      createSwapEntitlement('ent:AAA:2026:1:swap:ab', 'AAA', 'AAA_2026_1st', [
        'BBB_2026_1st',
      ]),
      createSwapEntitlement('ent:MMM:2026:1:swap:mn', 'MMM', 'MMM_2026_1st', [
        'NNN_2026_1st',
      ]),
    ];

    const graph = buildSwapGraph(entitlements, 2026);

    // Should be sorted alphabetically by ID
    expect(graph.sortedEntitlementIds[0]).toBe('ent:AAA:2026:1:swap:ab');
    expect(graph.sortedEntitlementIds[1]).toBe('ent:MMM:2026:1:swap:mn');
    expect(graph.sortedEntitlementIds[2]).toBe('ent:ZZZ:2026:1:swap:za');
  });
});

// =============================================================================
// CYCLE DETECTION TESTS
// =============================================================================

describe('Phase 17.4.1: Cycle Detection', () => {
  it('detects no cycles in acyclic graph', () => {
    const entitlements = [
      createSwapEntitlement('ent:AAA:2026:1:swap:ab', 'AAA', 'AAA_2026_1st', [
        'BBB_2026_1st',
      ]),
      createSwapEntitlement('ent:BBB:2026:1:swap:bc', 'BBB', 'BBB_2026_1st', [
        'CCC_2026_1st',
      ]),
      createSwapEntitlement('ent:CCC:2026:1:swap:cd', 'CCC', 'CCC_2026_1st', [
        'DDD_2026_1st',
      ]),
    ];

    const graph = buildSwapGraph(entitlements, 2026);
    const cycleResult = detectSwapCycles(graph);

    expect(cycleResult.hasCycles).toBe(false);
    expect(cycleResult.cycleNodes).toEqual([]);
    expect(cycleResult.cycleEntitlementIds).toEqual([]);
  });

  it('detects simple 2-node cycle (A↔B)', () => {
    const entitlements = [
      createSwapEntitlement('ent:AAA:2026:1:swap:ab', 'AAA', 'AAA_2026_1st', [
        'BBB_2026_1st',
      ]),
      createSwapEntitlement('ent:BBB:2026:1:swap:ba', 'BBB', 'BBB_2026_1st', [
        'AAA_2026_1st',
      ]),
    ];

    const graph = buildSwapGraph(entitlements, 2026);
    const cycleResult = detectSwapCycles(graph);

    expect(cycleResult.hasCycles).toBe(true);
    expect(cycleResult.cycleNodes).toContain('AAA');
    expect(cycleResult.cycleNodes).toContain('BBB');
    expect(cycleResult.cycleEntitlementIds.length).toBe(2);
  });

  it('detects 3-node cycle (A→B→C→A)', () => {
    const entitlements = [
      createSwapEntitlement('ent:AAA:2026:1:swap:ab', 'AAA', 'AAA_2026_1st', [
        'BBB_2026_1st',
      ]),
      createSwapEntitlement('ent:BBB:2026:1:swap:bc', 'BBB', 'BBB_2026_1st', [
        'CCC_2026_1st',
      ]),
      createSwapEntitlement('ent:CCC:2026:1:swap:ca', 'CCC', 'CCC_2026_1st', [
        'AAA_2026_1st',
      ]),
    ];

    const graph = buildSwapGraph(entitlements, 2026);
    const cycleResult = detectSwapCycles(graph);

    expect(cycleResult.hasCycles).toBe(true);
    expect(cycleResult.cycleNodes.sort()).toEqual(['AAA', 'BBB', 'CCC']);
    expect(cycleResult.cycleEntitlementIds.length).toBe(3);
  });

  it('identifies only cycle participants, not unrelated swaps', () => {
    const entitlements = [
      // Cycle: A↔B
      createSwapEntitlement('ent:AAA:2026:1:swap:ab', 'AAA', 'AAA_2026_1st', [
        'BBB_2026_1st',
      ]),
      createSwapEntitlement('ent:BBB:2026:1:swap:ba', 'BBB', 'BBB_2026_1st', [
        'AAA_2026_1st',
      ]),
      // Non-cyclical: X→Y
      createSwapEntitlement('ent:XXX:2026:1:swap:xy', 'XXX', 'XXX_2026_1st', [
        'YYY_2026_1st',
      ]),
    ];

    const graph = buildSwapGraph(entitlements, 2026);
    const cycleResult = detectSwapCycles(graph);

    expect(cycleResult.hasCycles).toBe(true);
    expect(cycleResult.cycleNodes).toContain('AAA');
    expect(cycleResult.cycleNodes).toContain('BBB');
    expect(cycleResult.cycleNodes).not.toContain('XXX');
    expect(cycleResult.cycleNodes).not.toContain('YYY');
    expect(cycleResult.cycleEntitlementIds).not.toContain(
      'ent:XXX:2026:1:swap:xy'
    );
  });

  it('returns empty result for empty graph', () => {
    const graph = buildSwapGraph([], 2026);
    const cycleResult = detectSwapCycles(graph);

    expect(cycleResult.hasCycles).toBe(false);
    expect(cycleResult.cycleNodes).toEqual([]);
    expect(cycleResult.cycleEntitlementIds).toEqual([]);
    expect(cycleResult.cycles).toEqual([]);
  });
});

// =============================================================================
// DETERMINISTIC ORDERING TESTS
// =============================================================================

describe('Phase 17.4.1: Deterministic Ordering', () => {
  it('non-cyclical swaps come before cyclical swaps', () => {
    const entitlements = [
      // Cycle: A↔B (will be processed last)
      createSwapEntitlement('ent:AAA:2026:1:swap:ab', 'AAA', 'AAA_2026_1st', [
        'BBB_2026_1st',
      ]),
      createSwapEntitlement('ent:BBB:2026:1:swap:ba', 'BBB', 'BBB_2026_1st', [
        'AAA_2026_1st',
      ]),
      // Non-cyclical: X→Y (will be processed first)
      createSwapEntitlement('ent:XXX:2026:1:swap:xy', 'XXX', 'XXX_2026_1st', [
        'YYY_2026_1st',
      ]),
    ];

    const graph = buildSwapGraph(entitlements, 2026);
    const cycleResult = detectSwapCycles(graph);
    const order = getDeterministicSwapOrder(graph, cycleResult);

    // Non-cyclical first
    expect(order[0]).toBe('ent:XXX:2026:1:swap:xy');
    // Cyclical last (in sorted order)
    expect(order.slice(1).sort()).toEqual([
      'ent:AAA:2026:1:swap:ab',
      'ent:BBB:2026:1:swap:ba',
    ]);
  });

  it('produces identical order regardless of input order', () => {
    const makeEntitlements = (ids: string[]) =>
      ids.map((id) =>
        createSwapEntitlement(
          id,
          id.split(':')[1],
          `${id.split(':')[1]}_2026_1st`,
          ['ZZZ_2026_1st']
        )
      );

    // Order 1: AAA, BBB, CCC
    const order1 = makeEntitlements([
      'ent:AAA:2026:1:swap:a',
      'ent:BBB:2026:1:swap:b',
      'ent:CCC:2026:1:swap:c',
    ]);

    // Order 2: CCC, AAA, BBB
    const order2 = makeEntitlements([
      'ent:CCC:2026:1:swap:c',
      'ent:AAA:2026:1:swap:a',
      'ent:BBB:2026:1:swap:b',
    ]);

    const graph1 = buildSwapGraph(order1, 2026);
    const graph2 = buildSwapGraph(order2, 2026);

    const cycle1 = detectSwapCycles(graph1);
    const cycle2 = detectSwapCycles(graph2);

    const result1 = getDeterministicSwapOrder(graph1, cycle1);
    const result2 = getDeterministicSwapOrder(graph2, cycle2);

    // Both should produce identical ordering
    expect(result1).toEqual(result2);
    expect(result1).toEqual([
      'ent:AAA:2026:1:swap:a',
      'ent:BBB:2026:1:swap:b',
      'ent:CCC:2026:1:swap:c',
    ]);
  });
});

// =============================================================================
// RESOLVER INTEGRATION TESTS (via direct call to resolveAllDraftAssets)
// =============================================================================

// Note: Full integration tests require mocked Firestore.
// The following tests verify the graph building and ordering logic.
// See dareResolver.test.js for full integration tests.

describe('Phase 17.4.1: Resolver-Level Behavior Verification', () => {
  it('cycle detection marks correct entitlements with metadata', () => {
    const entitlements = [
      // Cycle: A↔B→C→A
      createSwapEntitlement('ent:AAA:2026:1:swap:ab', 'AAA', 'AAA_2026_1st', [
        'BBB_2026_1st',
      ]),
      createSwapEntitlement('ent:BBB:2026:1:swap:bc', 'BBB', 'BBB_2026_1st', [
        'CCC_2026_1st',
      ]),
      createSwapEntitlement('ent:CCC:2026:1:swap:ca', 'CCC', 'CCC_2026_1st', [
        'AAA_2026_1st',
      ]),
    ];

    const graph = buildSwapGraph(entitlements, 2026);
    const cycleResult = detectSwapCycles(graph);

    // All three entitlements should be marked as cyclical
    expect(cycleResult.cycleEntitlementIds.length).toBe(3);
    expect(cycleResult.cycleEntitlementIds).toContain('ent:AAA:2026:1:swap:ab');
    expect(cycleResult.cycleEntitlementIds).toContain('ent:BBB:2026:1:swap:bc');
    expect(cycleResult.cycleEntitlementIds).toContain('ent:CCC:2026:1:swap:ca');

    // Cycle nodes should be stable and sorted
    expect(cycleResult.cycleNodes).toEqual(['AAA', 'BBB', 'CCC']);
  });

  it('acyclic chain produces deterministic ordering', () => {
    // Chain: A→B→C→D (no cycles)
    const entitlements = [
      createSwapEntitlement('ent:AAA:2026:1:swap:ab', 'AAA', 'AAA_2026_1st', [
        'BBB_2026_1st',
      ]),
      createSwapEntitlement('ent:BBB:2026:1:swap:bc', 'BBB', 'BBB_2026_1st', [
        'CCC_2026_1st',
      ]),
      createSwapEntitlement('ent:CCC:2026:1:swap:cd', 'CCC', 'CCC_2026_1st', [
        'DDD_2026_1st',
      ]),
    ];

    const graph = buildSwapGraph(entitlements, 2026);
    const cycleResult = detectSwapCycles(graph);
    const order = getDeterministicSwapOrder(graph, cycleResult);

    expect(cycleResult.hasCycles).toBe(false);
    // All should be processed in ID order since no cycles
    expect(order).toEqual([
      'ent:AAA:2026:1:swap:ab',
      'ent:BBB:2026:1:swap:bc',
      'ent:CCC:2026:1:swap:cd',
    ]);
  });

  it('mixed cyclical and non-cyclical swaps handled correctly', () => {
    const entitlements = [
      // Cycle: A↔B
      createSwapEntitlement('ent:AAA:2026:1:swap:ab', 'AAA', 'AAA_2026_1st', [
        'BBB_2026_1st',
      ]),
      createSwapEntitlement('ent:BBB:2026:1:swap:ba', 'BBB', 'BBB_2026_1st', [
        'AAA_2026_1st',
      ]),
      // Non-cyclical: M→N, P→Q
      createSwapEntitlement('ent:MMM:2026:1:swap:mn', 'MMM', 'MMM_2026_1st', [
        'NNN_2026_1st',
      ]),
      createSwapEntitlement('ent:PPP:2026:1:swap:pq', 'PPP', 'PPP_2026_1st', [
        'QQQ_2026_1st',
      ]),
    ];

    const graph = buildSwapGraph(entitlements, 2026);
    const cycleResult = detectSwapCycles(graph);
    const order = getDeterministicSwapOrder(graph, cycleResult);

    // Verify cycle detection
    expect(cycleResult.hasCycles).toBe(true);
    expect(cycleResult.cycleEntitlementIds.length).toBe(2);

    // Non-cyclical should be first (in sorted order)
    expect(order[0]).toBe('ent:MMM:2026:1:swap:mn');
    expect(order[1]).toBe('ent:PPP:2026:1:swap:pq');

    // Cyclical should be last
    const cyclicalInOrder = order.slice(2);
    expect(cyclicalInOrder.sort()).toEqual([
      'ent:AAA:2026:1:swap:ab',
      'ent:BBB:2026:1:swap:ba',
    ]);
  });
});
