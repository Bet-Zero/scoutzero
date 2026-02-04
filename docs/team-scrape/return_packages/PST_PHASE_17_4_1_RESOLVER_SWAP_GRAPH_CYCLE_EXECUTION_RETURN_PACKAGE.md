# PST Phase 17.4.1 Return Package: Resolver-Level Swap Graph + Cycle Handling

**MODE**: EXECUTION COMPLETE  
**DATE**: 2026-02-04  
**MASTER DOC**: `docs/team-scrape/PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_MASTER.md`  
**SCOPE**: Resolver-level ordering + cycle detection + partial resolution policy

---

## Summary

Phase 17.4.1 adds **resolver-level swap graph ordering** to the DARE (Draft Asset Resolution Engine). This ensures:

1. **Deterministic ordering**: Swap entitlements are processed in a stable order regardless of input array order
2. **Cycle detection**: Circular swap chains (e.g., A↔B, B↔C, C↔A) are detected using DFS
3. **Partial resolution**: Only cyclical swaps are marked `unchanged` with `reason='cycle_detected'`; non-cyclical swaps resolve normally
4. **Metadata**: Cycle resolutions include `cycleNodes` and `cycleEntitlementIds` for debugging

---

## Files Changed

### New Files

| File                                                                         | Purpose                                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/features/architect/utils/entitlements/dare/swapGraph.ts`                | Swap dependency graph building, cycle detection via DFS, deterministic ordering |
| `src/tests/architect/dare/phase17_4_1_resolver_swap_graph_guardrail.test.ts` | 14 guardrail tests for ordering and cycle detection                             |

### Modified Files

| File                                                                    | Changes                                                                          |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/features/architect/utils/entitlements/dare/dareResolver.ts`        | Integrated swap graph ordering; swaps now processed globally with cycle handling |
| `src/features/architect/utils/entitlements/dare/index.ts`               | Added exports for swapGraph module                                               |
| `docs/team-scrape/PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_MASTER.md` | Updated Phase 17.4/17.4.1 status to COMPLETE                                     |

---

## Key Logic Notes

### Swap Graph Structure

```typescript
interface SwapGraph {
  nodes: Map<string, SwapGraphNode>; // teamCode → node
  edges: SwapGraphEdge[]; // entitlement relationships
  sortedEntitlementIds: string[]; // deterministic order
  entitlementsById: Map<string, EffectiveEntitlement>;
}
```

### Cycle Detection Algorithm

- Uses DFS with recursion stack tracking
- Identifies all nodes participating in cycles
- Maps cycle nodes back to entitlement IDs

### Resolution Order

1. **Conveyance first**: pick_ownership and conveyance_right entitlements (unchanged from before)
2. **Build swap graph**: Construct dependency graph for all swap_right entitlements
3. **Detect cycles**: Find all circular chains
4. **Order swaps**: Non-cyclical swaps first (sorted by ID), cyclical swaps last
5. **Resolve swaps**:
   - Cyclical → `unchanged` with `cycle_detected` reason
   - Non-cyclical → normal resolution via `resolveSwapForEntitlement()`

### Cycle Metadata in Resolution

```typescript
const cycleResolution: EntitlementResolution = {
  entitlementId: swapEntId,
  outcome: 'unchanged',
  year: draftYear,
  originalOwner: entitlement.holderTeam,
  reason: 'cycle_detected',
  cycleNodes: ['AAA', 'BBB', 'CCC'],
  cycleEntitlementIds: ['ent:AAA:...', 'ent:BBB:...', 'ent:CCC:...'],
  // ...
};
```

---

## Test Output

```
 ✓ src/tests/architect/dare/phase17_4_1_resolver_swap_graph_guardrail.test.ts (14)
 ✓ src/tests/architect/dare/phase17_4_pool_and_chained_swaps_guardrail.test.ts (11)
 ✓ src/tests/architect/dare/phase17_2_swap_guardrail.test.ts (24)
 ✓ src/tests/architect/dare/phase17_3_ladders_and_conversion_guardrail.test.ts (12)
 ✓ src/tests/architect/dare/phase17_1_protections_guardrail.test.ts (20)
 ✓ src/tests/architect/dare/dareResolver.test.js (16)
 ✓ src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.js (3)
 ✓ src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.js (6)
 ✓ src/tests/architect/dare/conveyanceResolutionAdapter.test.js (10)
 ✓ src/tests/architect/dare/protectionLadderFactory.test.js (27)
 ✓ src/tests/architect/dare/swapResolutionAdapter.test.js (8)
 ✓ src/tests/architect/dare/phaseD2_true_e2e_trade_to_advance_gate.test.js (17)

 Test Files  12 passed (12)
      Tests  168 passed (168)
```

---

## Build Output

```
✓ 3005 modules transformed.
✓ built in 51.47s
```

No TypeScript or build errors.

---

## Acceptance Criteria Checklist

- [x] Resolver processes swaps in deterministic order regardless of input array order
- [x] Cycles do not fail the year (`success=true`)
- [x] Only cyclical swaps get `unchanged + cycle_detected`
- [x] Non-cyclical swaps resolve normally
- [x] Existing Phase 17.1–17.4 tests continue to pass (168 tests, all passing)
- [x] Build passes
- [x] Master doc updated with Phase 17.4.1 status + summary

---

## New Test Coverage (Phase 17.4.1)

| Test                                                       | Description                  |
| ---------------------------------------------------------- | ---------------------------- |
| `builds graph with correct nodes and edges`                | Verifies graph structure     |
| `filters out entitlements for wrong year`                  | Year filtering               |
| `filters out already resolved entitlements`                | Skip resolved                |
| `sorts entitlements by ID for determinism`                 | Deterministic ordering       |
| `detects no cycles in acyclic graph`                       | No false positives           |
| `detects simple 2-node cycle (A↔B)`                       | Simple cycle detection       |
| `detects 3-node cycle (A→B→C→A)`                           | 3-node cycle detection       |
| `identifies only cycle participants, not unrelated swaps`  | Precise cycle identification |
| `returns empty result for empty graph`                     | Edge case handling           |
| `non-cyclical swaps come before cyclical swaps`            | Ordering verification        |
| `produces identical order regardless of input order`       | Determinism test             |
| `cycle detection marks correct entitlements with metadata` | Metadata verification        |
| `acyclic chain produces deterministic ordering`            | Chain ordering               |
| `mixed cyclical and non-cyclical swaps handled correctly`  | Mixed scenario               |

---

## Notes

- The existing `types.ts` already had `cycleNodes` and `cycleEntitlementIds` fields in `EntitlementResolution` - no changes needed there
- Swap resolution is now a **two-phase process**: graph building + ordered resolution
- This complements the Phase 17.4 adapter-level pool swap logic with resolver-level orchestration
