# Phase 8.2 — Encumbered Swap-Backing Hotfix Return Package

**Date**: 2026-01-28  
**Mode**: EXECUTION  
**Status**: ✅ COMPLETE

---

## Summary

Fixed incorrect `underlyingStatus: "encumbered"` tagging on `pick_ownership` EntitlementAssets. Previously, picks were marked as encumbered based on a heuristic (having ANY selectionSpecs attached), which overfired. Now, a pick is only marked encumbered if there exists an actual `swap_right` entitlement referencing its `underlyingPickId`.

---

## Problem Statement

The Phase 8 entitlement generator was marking `pick_ownership` assets as "encumbered" whenever the underlying pick had selectionSpecs in the ledger. This was incorrect because:

- selectionSpecs may produce `conveyance_right` entitlements (not swap rights)
- selectionSpecs may affect OTHER picks in a pool, not this specific pick
- The presence of selectionSpecs ≠ the pick is actually encumbered by a swap

**Evidence (pre-fix)**:

| Entitlement ID | underlyingPickId | underlyingStatus | swap_rights referencing it |
|----------------|------------------|------------------|---------------------------|
| `ent:HOU:2026:2:own:c00ccb46` | IND_2026_2nd | encumbered ❌ | 0 |
| `ent:HOU:2026:2:own:b1228bfb` | LAC_2026_2nd | encumbered ❌ | 0 |
| `ent:HOU:2026:2:own:7368affb` | MIA_2026_2nd | encumbered ❌ | 0 |

Total swap_right entitlements in system: 28  
Hits referencing IND/LAC/MIA 2026 2nd: 0

---

## Solution Implemented

### Rule: EncumberedIfSwapBacked

A `pick_ownership` entitlement is marked `encumbered` **if and only if**:

```
∃ swap_right entitlement E such that:
   E.swapControllerPickId === pickOwnership.underlyingPickId
   OR
   E.poolUnderlyingPickIds.includes(pickOwnership.underlyingPickId)
```

If no such swap_right exists → `underlyingStatus = "clean"`

When encumbered:

- `underlyingStatus = "encumbered"`
- `coveredByEntitlementIds = [sorted list of swap_right IDs]`

### Implementation

1. **Build swap_right index**: After generating all swap_right entitlements, create a `Map<underlyingPickId, entitlementId[]>` index
2. **Lookup during pick_ownership generation**: Check if the underlyingPickId exists in the index
3. **Invariant validator**: After all assets generated, verify no encumbered pick_ownership exists without swap backing

---

## Files Changed

| File                                                                          | Change                                                                           |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `team-scrape/draft-picks/scripts/pst/pst_phase_8_build_entitlement_assets.ts` | Added swap_right indexing, swap-backed encumbered detection, invariant validator |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`                             | Added Phase 8.2 entry (table + detailed section)                                 |

---

## Proof: Before/After

### Before (from git history / emulator snapshot)

```json
{
  "id": "ent:HOU:2026:2:own:c00ccb46",
  "underlyingPickId": "IND_2026_2nd",
  "underlyingStatus": "encumbered"
  // coveredByEntitlementIds: undefined
}
{
  "id": "ent:HOU:2026:2:own:b1228bfb",
  "underlyingPickId": "LAC_2026_2nd",
  "underlyingStatus": "encumbered"
  // coveredByEntitlementIds: undefined
}
{
  "id": "ent:HOU:2026:2:own:7368affb",
  "underlyingPickId": "MIA_2026_2nd",
  "underlyingStatus": "encumbered"
  // coveredByEntitlementIds: undefined
}
```

### After (post-fix)

```json
{
  "id": "ent:HOU:2026:2:own:c00ccb46",
  "underlyingPickId": "IND_2026_2nd",
  "underlyingStatus": "clean"
}
{
  "id": "ent:HOU:2026:2:own:b1228bfb",
  "underlyingPickId": "LAC_2026_2nd",
  "underlyingStatus": "clean"
}
{
  "id": "ent:HOU:2026:2:own:7368affb",
  "underlyingPickId": "MIA_2026_2nd",
  "underlyingStatus": "clean"
}
```

---

## Invariant Validator Output

```
=== Phase 8.2 Invariant Validation ===
✅ Invariant passed: 21 encumbered pick_ownership assets, all have valid swap backing
=== End Invariant Validation ===
```

Sample of properly encumbered picks (with swap backing):

```
ent:MIN:2026:2:own:497dc5b3
  underlyingPickId: SAS_2026_2nd
  coveredByEntitlementIds: ['ent:SAS:2026:2:swap:d3378878']

ent:NOP:2026:1:own:a7f84b36
  underlyingPickId: NOP_2026_1st
  coveredByEntitlementIds: ['ent:NOP:2026:1:swap:67d855c8']

ent:UTA:2026:1:own:8dfa7b6e
  underlyingPickId: UTA_2026_1st
  coveredByEntitlementIds: ['ent:UTA:2026:1:swap:1307f714', 'ent:UTA:2026:1:swap:b66b56b8']
```

---

## Outputs Regenerated

- ✅ `data/pst/pst_entitlement_assets_2026_2033.json`
- ✅ `data/pst/pst_entitlements_by_team_2026_2033.json`

---

## Master Doc Update Confirmation

- ✅ Phase table entry added: `Phase 8.2 | Encumbered Status Must Be Swap-Backed | COMPLETE | 2026-01-28`
- ✅ Detailed section added after Phase 8.1

---

## Acceptance Criteria Verification

| Criterion                                                                                                          | Status |
| ------------------------------------------------------------------------------------------------------------------ | ------ |
| No pick_ownership entitlement is marked encumbered unless a swap_right entitlement references its underlyingPickId | ✅     |
| Any encumbered pick_ownership has coveredByEntitlementIds populated (non-empty)                                    | ✅     |
| HOU 2026 R2 IND/LAC/MIA become clean                                                                               | ✅     |
| JSON outputs regenerated successfully                                                                              | ✅     |
| Master doc updated                                                                                                 | ✅     |

---

## Stop Conditions

No stop conditions triggered. Implementation did not require changes to parser semantics (Phase 4/5).
