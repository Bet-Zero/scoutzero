# PST Phase 17: Entitlement Resolution Engine — Preflight Return Package

**DATE**: 2026-02-03  
**MODE**: PREFLIGHT (Discovery Only — No Code Changes)  
**STATUS**: ✅ COMPLETE  
**MASTER DOC**: [PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_MASTER.md](../docs/team-scrape/PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_MASTER.md)

---

## Executive Summary

Phase 17 preflight successfully mapped the existing DARE (Draft Asset Resolution Engine) infrastructure and identified what's already implemented vs. what gaps remain. The system is well-architected with a clear path to production-grade resolution.

### Key Findings

| Area                      | Status             | Notes                                                                        |
| ------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| **DARE Core**             | ✅ Complete        | `resolveAllDraftAssets()` orchestrator exists and is wired to season advance |
| **Conveyance Resolution** | ✅ Partial         | Top-N, lottery protections work; ladders need verification                   |
| **Swap Resolution**       | ✅ Partial         | 2-team best_of/worst_of works; 3+ team pools not implemented                 |
| **Protection Ladder**     | ✅ Complete        | `buildProtectionLadder()` transforms pickRules correctly                     |
| **Entitlement Mutation**  | ✅ Complete        | World-scoped writes via `applyDAREResultsToBatch()`                          |
| **Multi-team Pools**      | ❌ Not Implemented | `poolUnderlyingPickIds` not resolved                                         |
| **Ranked Conveyance**     | ❌ Not Implemented | `receivesRank`, `receivesComparator` not resolved                            |

### Blocking Issues

**None found.** All required schema fields are present in entitlements and pickRules.

---

## Recommended Phase Breakdown

| Phase    | Scope                            | Effort | Acceptance      |
| -------- | -------------------------------- | ------ | --------------- |
| **17.1** | Protections + Simple Conveyance  | 2 days | 4 tests passing |
| **17.2** | Best-of/Worst-of 2-Team Swap     | 1 day  | 4 tests passing |
| **17.3** | Multi-Year Ladders + Conversion  | 2 days | 4 tests passing |
| **17.4** | Multi-Team Pools + Chained Swaps | 3 days | 3 tests passing |
| **17.5** | Ranked Conveyance + Priority     | 2 days | 3 tests passing |

**Total**: ~10 days execution

---

## Test Matrix (12 Required Cases)

| #   | Test Name                  | Category   | Setup                   | Expected             |
| --- | -------------------------- | ---------- | ----------------------- | -------------------- |
| 1   | `test_topN_at_boundary`    | Protection | Top 3, pos=3            | `rolled`             |
| 2   | `test_topN_conveys`        | Protection | Top 3, pos=7            | `conveyed`           |
| 3   | `test_lottery_boundary`    | Protection | Lottery, pos=14         | `rolled`             |
| 4   | `test_lottery_conveys`     | Protection | Lottery, pos=18         | `conveyed`           |
| 5   | `test_ladder_roll_y1`      | Ladder     | 2027 Top 5, pos=4       | `rolled`, year=2028  |
| 6   | `test_ladder_final_cancel` | Ladder     | Final tier, triggers    | `expired`            |
| 7   | `test_convert_to_2rp`      | Conversion | Conversion condition    | `converted`, round=2 |
| 8   | `test_convert_final_tier`  | Conversion | Final + conversion      | `converted`          |
| 9   | `test_swap_best_of`        | Swap       | NOP=10, MIL=5           | winner=MIL           |
| 10  | `test_swap_worst_of`       | Swap       | worst_of, NOP=10, MIL=5 | winner=NOP           |
| 11  | `test_swap_tie_break`      | Swap       | Both pos=10             | winner=controller    |
| 12  | `test_skip_resolved`       | Guardrail  | resolved=true           | `unchanged`          |

---

## Integration Wiring Summary

```
seasonManager.advanceSeasonInWorld()
      │
      ├─► getDraftPositionsMap() → positionsMap
      ├─► resolveAllDraftAssets() ← DARE ENTRY
      │       ├─► resolveConveyanceForEntitlement()
      │       ├─► resolveSwapForEntitlement()
      │       └─► buildEntitlementWritesFromResolution()
      └─► applyDAREResultsToBatch() → Firestore writes
```

**Already integrated**: DARE runs during season advance at line 636 of `seasonManager.js`.

---

## Key Decisions Made

| Decision            | Choice                         | Rationale                                 |
| ------------------- | ------------------------------ | ----------------------------------------- |
| Engine granularity  | Per-year (all teams)           | Swaps require cross-team comparison       |
| Priority ordering   | Alphabetical by entitlement ID | Deterministic, stable                     |
| SwapType default    | `best_of`                      | Conservative for receiving team           |
| Resolution order    | Conveyance → Swaps             | Rolled picks update before swap eval      |
| Entitlements source | World (not base)               | World may have traded/rolled entitlements |

---

## Files Identified for Phase 17 Execution

### Core DARE Files (Verify/Enhance)

| File                                                                            | Phase      | Action                       |
| ------------------------------------------------------------------------------- | ---------- | ---------------------------- |
| `src/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter.ts` | 17.1, 17.3 | Verify ladder iteration      |
| `src/features/architect/utils/entitlements/dare/swapResolutionAdapter.ts`       | 17.2, 17.4 | Add pool resolution          |
| `src/features/architect/utils/entitlements/dare/dareResolver.ts`                | 17.4       | Add topological sort         |
| `src/features/architect/utils/entitlements/dare/entitlementMutator.ts`          | 17.3       | Verify rolled/converted docs |
| `src/features/architect/utils/entitlements/dare/protectionLadderFactory.ts`     | 17.1       | Already complete             |

### Legacy Files (No Changes Needed)

| File                                                                      | Status                  |
| ------------------------------------------------------------------------- | ----------------------- |
| `src/features/architect/utils/tradeMachine/utils/swapResolution.js`       | Legacy, DARE supersedes |
| `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js` | Legacy, DARE supersedes |

### Test Files (Existing Coverage)

| File                                                           | Tests      |
| -------------------------------------------------------------- | ---------- |
| `src/tests/architect/dare/dareResolver.test.js`                | 10+ mocked |
| `src/tests/architect/dare/conveyanceResolutionAdapter.test.js` | 12+        |
| `src/tests/architect/dare/swapResolutionAdapter.test.js`       | 8+         |
| `src/tests/architect/dare/protectionLadderFactory.test.js`     | 15+        |

---

## Schema Field Availability (Confirmed)

### Entitlement Fields ✅

- `underlyingPickId` - present on all `pick_ownership`
- `swapControllerPickId` - present on `swap_right`
- `poolUnderlyingPickIds` - present for pool swaps
- `receivesRank`, `receivesComparator` - present for ranked conveyance
- `resolved` - used for skip-if-resolved guard

### PickRules Fields ✅

- `protections[].type` - `'top_n' | 'range' | 'lottery'`
- `protections[].protectedRange` - e.g., `"1-3"`
- `protections[].appliesToYears` - multi-year ladder support
- `conditions[].kind` - `'swap' | 'conveys' | 'did_not_convey'`
- `conditions[].relatedPickIds` - conversion targets

---

## Stop Condition Checks

| Condition                                   | Result                                          |
| ------------------------------------------- | ----------------------------------------------- |
| pickRules lacks protection data             | ✅ OK - `protections[]` present                 |
| entitlements lack underlyingPickId          | ✅ OK - present on all pick_ownership           |
| seasonManager depends on unavailable fields | ✅ OK - `_derivedDraftPicks` projection handles |

**No blocking issues found.**

---

## Next Steps

1. **Phase 17.1 Execution**: Verify existing protection/conveyance logic, add any missing tests
2. **Phase 17.2 Execution**: Verify 2-team swap logic, add tie-break tests
3. **Phase 17.3 Execution**: Verify multi-year ladder iteration, test conversion flow
4. **Phase 17.4 Planning**: Design pool resolution algorithm, topological sort for chains
5. **Phase 17.5 Planning**: Design ranked conveyance resolution, priority ordering

---

## Artifacts Created

| Artifact            | Path                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Phase 17 Master Doc | `docs/team-scrape/PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_MASTER.md`                  |
| Return Package      | `return_packages/PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_PREFLIGHT_RETURN_PACKAGE.md` |
| Master Plan Update  | `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` (Phase 17 row added)                   |

---

## Validation

- [x] File map produced with call graph
- [x] Schema inventory with field availability matrix
- [x] Behavior matrix covering protections, ladders, conversions, swaps
- [x] Phased execution plan (17.1 → 17.5)
- [x] 12 test cases specified
- [x] Integration wiring diagram
- [x] Stop conditions checked (none blocking)
- [x] Key decisions documented
