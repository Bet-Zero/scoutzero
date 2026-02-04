# PST Phase 17.4: Pool Swaps + Chained Swaps + Cycle Detection

## Execution Return Package

**Completed:** 2026-02-04  
**Phase:** PST Phase 17.4 - Pool Swaps (3+ Teams), Chained Swaps, Circular Detection  
**Status:** ✅ COMPLETE

---

## Summary

Phase 17.4 extends the DARE (Draft Asset Resolution Engine) swap resolution system to support:

1. **Pool swaps (3+ teams)** - Comparing all teams in a `poolUnderlyingPickIds` array plus the controller
2. **Tie-break logic** - Position-based primary, controller wins ties, alphabetical tertiary
3. **Chained swap foundation** - Deterministic resolution regardless of input order
4. **Cycle detection preparation** - Framework for graph-based cycle detection (resolver-level)

---

## Files Modified

### 1. `src/features/architect/utils/entitlements/dare/types.ts`

**Changes:**

- Added new optional fields to `EntitlementResolution` interface:
  - `loserTeams?: string[]` - Teams that lost the pool swap
  - `positionsCompared?: Record<string, number>` - Position map snapshot for audit
  - `poolCandidates?: string[]` - All teams in pool comparison
  - `cycleNodes?: string[]` - Teams involved in cycle (if detected)
  - `cycleEntitlementIds?: string[]` - Entitlement IDs in cycle (if detected)

### 2. `src/features/architect/utils/entitlements/dare/swapResolutionAdapter.ts`

**Complete rewrite** with the following structure:

| Function                          | Purpose                                           |
| --------------------------------- | ------------------------------------------------- |
| `resolveSwapForEntitlement()`     | Main entry - routes to pool or 2-team swap        |
| `resolvePoolSwapForEntitlement()` | Handles pool swap resolution                      |
| `resolvePoolSwap()`               | Core pool comparison logic                        |
| `sortCandidatesForSwap()`         | Tie-break sorting (position → controller → alpha) |
| `resolve2TeamSwap()`              | Original 2-team logic preserved                   |
| `resolveSwapWinner()`             | Legacy 2-team helper                              |
| `parseSwapType()`                 | Parse best_of/worst_of from entitlement           |
| `parseTeamFromPickId()`           | Extract team from pick ID                         |
| `isPoolSwap()`                    | Detect if entitlement is pool swap                |

**Key Logic:**

```typescript
// Pool detection
const isPoolSwap = Array.isArray(poolPickIds) && poolPickIds.length >= 1;

// Build candidate set (controller ALWAYS included)
const candidates = new Set<string>();
candidates.add(controllerTeam); // Controller always included
for (const pickId of poolPickIds) {
  const team = parseTeamFromPickId(pickId);
  if (team && positionsMap[team] !== undefined) {
    candidates.add(team);
  }
}

// Tie-break order
function sortCandidatesForSwap(
  candidates: string[],
  controllerTeam: string,
  positions: Record<string, number>,
  swapType: 'best_of' | 'worst_of'
) {
  return candidates.sort((a, b) => {
    const posA = positions[a];
    const posB = positions[b];
    const posCmp = swapType === 'best_of' ? posA - posB : posB - posA;
    if (posCmp !== 0) return posCmp;

    // Controller wins ties
    if (a === controllerTeam) return -1;
    if (b === controllerTeam) return 1;

    // Alphabetical tertiary
    return a.localeCompare(b);
  });
}
```

### 3. `src/tests/architect/dare/phase17_4_pool_and_chained_swaps_guardrail.test.ts`

**New test file** with 11 test cases:

| Test Case                                    | Description                                               |
| -------------------------------------------- | --------------------------------------------------------- |
| `pool_best_of_3`                             | Selects team with lowest position                         |
| `pool_worst_of_3`                            | Selects team with highest position                        |
| `pool_tie_controller_wins`                   | Controller wins ties in best_of                           |
| `pool_missing_positions_filters`             | Resolves with available teams when some missing           |
| `pool_insufficient_candidates_unchanged`     | Returns unchanged when <2 candidates                      |
| `chained_acyclic_resolves_deterministically` | Same results regardless of input order                    |
| `alphabetical_tiebreak`                      | AAA beats BBB when both non-controller with same position |
| `individual_swaps_resolve_independently`     | Adapter-level cycle behavior                              |
| `controller_always_in_pool`                  | Controller included even if not in poolUnderlyingPickIds  |
| `worst_of_from_description`                  | Parses worst_of from description text                     |
| `single_pool_pick_uses_pool_logic`           | Resolves correctly with controller included               |

---

## Design Decisions

Per user confirmation during implementation:

1. **Cycle Handling:** `success=true` with only cyclical swaps marked unchanged + `cycle_detected` reason. Non-cyclical swaps still resolve normally.

2. **Controller Inclusion:** Controller is ALWAYS included in pool comparison, even if not explicitly in `poolUnderlyingPickIds`.

3. **Position Mutation:** Positions are NOT mutated in Phase 17.4. Ordering is for determinism only - actual position changes happen via dareResolver entitlement updates.

---

## Test Results

```
 ✓ src/tests/architect/dare/phase17_4_pool_and_chained_swaps_guardrail.test.ts (11)
   ✓ Phase 17.4: Pool Swap Resolution (5)
   ✓ Phase 17.4: Chained Swap Resolution (2)
   ✓ Phase 17.4: Cycle Detection (1)
   ✓ Phase 17.4: Edge Cases (3)

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

### Regression Tests

All existing swap tests continue to pass:

```
 ✓ src/tests/architect/dare/swapResolutionAdapter.test.js (8)
 ✓ src/tests/architect/dare/phase17_2_swap_guardrail.test.ts (24)
```

---

## Build Verification

```
✓ 3004 modules transformed
✓ built in 1m 24s
```

No new TypeScript errors introduced.

---

## What's NOT Included (Future Phases)

1. **Full Cycle Detection in dareResolver.ts** - The swap adapter resolves individual swaps. Cycle detection at the resolver level (building swap graph, topological ordering, DFS cycle detection) is foundational but the full graph-based resolution order is a follow-on task.

2. **Position Mutation** - Positions are compared but not mutated. The resolver handles entitlement outcome updates.

3. **Complex Chained Scenarios** - Multi-hop chains where Swap B depends on Swap A's outcome require resolver-level ordering which builds on this foundation.

---

## Integration Points

The updated `swapResolutionAdapter.ts` is called from `dareResolver.ts` in the `resolveSwapsForYear()` function. No changes to the resolver were required for this phase - the adapter now handles pool swaps transparently.

---

## Files to Review

| File                                                                                                                                    | Lines | Purpose                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------ |
| [types.ts](../../src/features/architect/utils/entitlements/dare/types.ts)                                                               | 1-80  | New resolution fields    |
| [swapResolutionAdapter.ts](../../src/features/architect/utils/entitlements/dare/swapResolutionAdapter.ts)                               | 1-330 | Pool swap implementation |
| [phase17_4_pool_and_chained_swaps_guardrail.test.ts](../../src/tests/architect/dare/phase17_4_pool_and_chained_swaps_guardrail.test.ts) | 1-265 | Guardrail tests          |

---

## Acceptance Criteria Met

| Criterion                                             | Status |
| ----------------------------------------------------- | ------ |
| Pool swap detects `poolUnderlyingPickIds.length >= 1` | ✅     |
| Controller always in candidate pool                   | ✅     |
| Tie-break: position → controller → alphabetical       | ✅     |
| `loserTeams[]` populated on resolution                | ✅     |
| `poolCandidates[]` populated on resolution            | ✅     |
| `positionsCompared{}` snapshot available              | ✅     |
| Returns unchanged when <2 candidates with positions   | ✅     |
| Existing 2-team swap tests pass                       | ✅     |
| Build succeeds                                        | ✅     |
| 11+ guardrail tests pass                              | ✅     |

---

## Cleanup

Temporary helper script can be removed:

- `/scripts/write-phase17-4-files.cjs` - Used to work around terminal issues during implementation
