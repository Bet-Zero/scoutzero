# PST Phase 17.5 — Ranked Conveyance + Priority Conflict Resolution

## RETURN PACKAGE

**Date:** 2026-02-04
**Phase:** 17.5
**Status:** COMPLETE
**Owner:** architect/entitlements

---

## Executive Summary

Phase 17.5 extends the Draft Asset Resolution Engine (DARE) with two key capabilities:

1. **Ranked Conveyance Selection** - Resolves `conveyance_right` entitlements that have a `poolUnderlyingPickIds` array by selecting one pick based on `receivesComparator` (`more_favorable` = best_of, `less_favorable` = worst_of).

2. **Priority Conflict Resolution** - Detects when multiple entitlements claim the same underlying pick and resolves conflicts using deterministic priority ordering (entitlement kind priority, then alphabetical ID).

All implementation follows the hard scope boundary: only `pick_ownership` and `conveyance_right` are evaluated for conflicts. **Swap conflicts intentionally deferred to future phase.**

---

## Files Modified

| File | Changes |
|------|---------|
| `src/features/architect/utils/entitlements/dare/types.ts` | Added `conflictWinnerEntitlementId?: string` and `selectedPickId?: string` to `EntitlementResolution` interface |
| `src/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter.ts` | Added `selectRankedPick()` helper function; integrated ranked conveyance selection into `resolveConveyanceForEntitlement()`; added metadata to all resolution outcomes |
| `src/features/architect/utils/entitlements/dare/dareResolver.ts` | Added `getEntitlementPriority()`, `getClaimKey()`, and `resolveConflicts()` helper functions; integrated conflict detection pass after conveyance resolution |

### New Files

| File | Purpose |
|------|---------|
| `src/tests/architect/dare/phase17_5_ranked_conveyance_and_conflict_guardrail.test.ts` | 17 guardrail tests covering ranked conveyance, conflict resolution, determinism, and edge cases |

---

## Key Logic Notes

### Ranked Conveyance Selection (`selectRankedPick`)

```
Input: entitlement with poolUnderlyingPickIds + receivesComparator, positionsMap
Output: { selectedPickId, winnerTeam, positionsCompared, poolCandidates } | null

Algorithm:
1. Parse team codes from poolUnderlyingPickIds
2. Filter to teams with valid positions in positionsMap
3. If < 2 candidates → return null
4. Sort by comparator:
   - more_favorable: ascending position (lower = better)
   - less_favorable: descending position (higher = worse)
5. Tie-break order:
   (1) position
   (2) holder team wins
   (3) alphabetical teamCode
6. Return first candidate as winner
```

### Entitlement Priority Function (`getEntitlementPriority`)

```
Priority (lower = stronger):
  1 = pick_ownership
  2 = conveyance_right
  3 = swap_right
  99 = unknown
```

### Conflict Resolution (`resolveConflicts`)

```
Input: resolutions[], entitlementsById Map
Output: modified resolutions[] with conflicts resolved

Algorithm:
1. Build claim map: claimKey → resolutions[]
   - claimKey = selectedPickId (ranked) OR underlyingPickId
   - Only pick_ownership + conveyance_right included
   - Skip already-unchanged resolutions
2. For each claim with 2+ resolutions:
   - Sort by: (1) priority ascending, (2) alphabetical ID
   - Winner = first after sort
   - Losers marked: outcome='unchanged', reason='conflict_lost', conflictWinnerEntitlementId=winner.id
3. Skip writes for conflict_lost resolutions
```

---

## Behavior Matrix

| Scenario | Input | Expected Outcome |
|----------|-------|------------------|
| Ranked more_favorable | Pool [A:15, B:5, C:10], comparator=more_favorable | Winner: B (position 5) |
| Ranked less_favorable | Pool [A:15, B:5, C:10], comparator=less_favorable | Winner: A (position 15) |
| Ranked tie - holder wins | Pool [A:10, B:10], holder=A | Winner: A |
| Ranked tie - alphabetical | Pool [A:10, B:10], holder=C | Winner: A (alphabetical) |
| Ranked insufficient | Pool [A], only A has position | outcome=unchanged, reason=insufficient |
| Conflict ownership vs conveyance | Both claim same pick | ownership wins (priority 1 vs 2) |
| Conflict same kind | Two pick_ownership, IDs "ent:A" vs "ent:B" | ent:A wins (alphabetical) |
| Conflict loser | Losing entitlement | outcome=unchanged, reason=conflict_lost |
| Swaps | swap_right entitlements | NOT evaluated in conflict pass |

---

## Test Output

```
 ✓ Phase 17.5: Ranked Conveyance Selection > more_favorable > selects lowest position from pool
 ✓ Phase 17.5: Ranked Conveyance Selection > less_favorable > selects highest position from pool
 ✓ Phase 17.5: Ranked Conveyance Selection > tie-break: holder wins ties
 ✓ Phase 17.5: Ranked Conveyance Selection > tie-break: alphabetical when holder not in tie
 ✓ Phase 17.5: Ranked Conveyance Selection > missing positions handling > ignores teams missing positions
 ✓ Phase 17.5: Ranked Conveyance Selection > insufficient candidates > returns null when < 2 candidates
 ✓ Phase 17.5: Ranked Conveyance Selection > insufficient candidates > returns null for middle comparator
 ✓ Phase 17.5: Ranked Conveyance Resolution Integration > resolves ranked conveyance with metadata
 ✓ Phase 17.5: Ranked Conveyance Resolution Integration > returns unchanged for insufficient pool
 ✓ Phase 17.5: Priority Conflict Resolution > pick_ownership beats conveyance_right
 ✓ Phase 17.5: Priority Conflict Resolution > same-kind alphabetical wins
 ✓ Phase 17.5: Priority Conflict Resolution > swap_right excluded
 ✓ Phase 17.5: Determinism Verification > identical results regardless of pool order
 ✓ Phase 17.5: Determinism Verification > tie-break identical regardless of pool order
 ✓ Phase 17.5: Edge Cases > handles empty poolUnderlyingPickIds
 ✓ Phase 17.5: Edge Cases > handles missing receivesComparator
 ✓ Phase 17.5: Edge Cases > falls back to single underlyingPickId when no pool

Test Files  1 passed (1)
     Tests  17 passed (17)
  Duration  2.49s
```

---

## Build Output

```
vite v4.5.14 building for production...
✓ 3005 modules transformed.
✓ built in 26.34s

dist/assets/index-e6a2a491.js  2,058.91 kB │ gzip: 598.19 kB
```

Build passes with no TypeScript errors.

---

## Regression Risk

**LOW RISK**

| Area | Risk | Mitigation |
|------|------|------------|
| Existing conveyance resolution | Low | Single-pick flow unchanged; ranked selection only activates when `poolUnderlyingPickIds` + `receivesComparator` present |
| Existing swap resolution | None | Swaps explicitly excluded from conflict pass; swap graph logic untouched |
| Existing protection ladder | None | Protection logic unchanged; ranked conveyances use same protection flow after pick selection |
| Existing tests | None | All 210 existing DARE tests pass |

---

## Master Doc Update

The following should be added to `docs/team-scrape/PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_MASTER.md`:

```markdown
## Phase 17.5: Ranked Conveyance + Priority Conflict Resolution ✅

**Status:** COMPLETE (2026-02-04)

### Capabilities Added
1. Ranked conveyance selection via `receivesComparator` field
2. Deterministic entitlement priority ordering
3. Conflict detection and resolution for pick_ownership + conveyance_right

### Implementation Files
- `dare/types.ts` - Added `conflictWinnerEntitlementId`, `selectedPickId` fields
- `dare/conveyanceResolutionAdapter.ts` - Added `selectRankedPick()` helper
- `dare/dareResolver.ts` - Added conflict detection pass

### Out of Scope (Deferred)
- Swap conflict resolution
- Swap claim semantics
- Graph rewrites
```

---

## Explicit Statement

> **Swap conflicts intentionally deferred to future phase.**

Per the hard scope boundary, this phase does NOT modify swap behavior. Only `pick_ownership` and `conveyance_right` entitlements are evaluated in the conflict resolution pass. Swap entitlements (`swap_right`) are explicitly excluded and continue to use the existing swap graph resolution from Phase 17.4.

---

## Acceptance Criteria Verification

| Criteria | Status |
|----------|--------|
| Ranked pools resolve correctly | ✅ PASS |
| Priority conflicts deterministic | ✅ PASS |
| No swap behavior changed | ✅ PASS |
| No architecture rewrites | ✅ PASS |
| Build passes | ✅ PASS |
| All tests pass | ✅ PASS (210 existing + 17 new) |
| No unrelated diffs | ✅ PASS |
