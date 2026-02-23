# TM-EXCL-E5 — EXECUTION RETURN PACKAGE

**Ticket:** TM-EXCL-E5  
**Title:** Structured Protections + Partition Validation  
**Status:** ✅ COMPLETE  
**Date:** 2026-02-20

---

## Summary

Added a machine-readable protection range model (`structuredCondition`) and partition validator so the system can distinguish valid pick partitions (e.g., "Top 10 protected" + "11–30 unprotected") from invalid ones (e.g., "Top 10" + "8–30" with positions 8–10 overlapping). This runs at save-time and trade-time through the existing exclusivity gate infrastructure.

---

## Files Changed

### New Files

| File                                                                        | Purpose                                                                                                                                                  |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/entitlements/protectionPartitionValidator.ts` | Pure partition validator: `expandProtectionCoverage()`, `checkProtectionPartitionPair()`, `validateProtectionPartition()`, `getPartitionOverlapDetail()` |
| `src/tests/architect/protectionPartitionValidator.test.ts`                  | 29 tests covering all acceptance criteria                                                                                                                |

### Modified Files

| File                                                                           | Change                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/schemas/architect.ts`                                                     | Added `StructuredConditionZ` Zod schema + `structuredCondition` optional field to `EntitlementProtectionLadderTierZ`                                                                                      |
| `src/features/architect/utils/entitlements/dare/types.ts`                      | Added `StructuredCondition` interface + `structuredCondition?` to `ProtectionLadderTier`                                                                                                                  |
| `src/features/architect/utils/entitlements/dare/protectionLadderFactory.ts`    | Auto-populates `structuredCondition` from `parseProtectionThreshold()` in both override and rule-derived ladder paths                                                                                     |
| `src/features/architect/utils/entitlements/entitlementExclusivityValidator.ts` | Added `OVERLAP_PROTECTION_RANGE` violation type; extended `EntitlementDocLike` with `protectionLadder`; Rule #1 now delegates to partition check (Rule #5) before emitting `DUP_PICK_OWNERSHIP_UNDERLIER` |
| `src/features/architect/utils/entitlements/computeEntitlementClaims.ts`        | Added `OVERLAP_PROTECTION_RANGE` to `CONFLICT_TYPE_LABELS`                                                                                                                                                |
| `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md`                 | Added §10.10 "Structured Protections + Partition Validation"                                                                                                                                              |

---

## Acceptance Criteria

| Criterion                                | Status | Evidence                                                                                                               |
| ---------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| Top 10 + 11–30 passes                    | ✅     | Test: "passes for valid partition (Top 10 + 11–30 same underlier)" — `result.valid === true`                           |
| Top 10 + 8–30 fails                      | ✅     | Test: "emits OVERLAP_PROTECTION_RANGE for Top 10 + 8–30 same underlier" — violation type is `OVERLAP_PROTECTION_RANGE` |
| Missing structuredCondition fails closed | ✅     | Test: "falls back to DUP_PICK_OWNERSHIP_UNDERLIER when structuredCondition missing" — original Rule #1 fires           |

---

## Validation Commands Run

| Command                                                                          | Result                                  |
| -------------------------------------------------------------------------------- | --------------------------------------- |
| `npm run build`                                                                  | ✅ Pass — 3050 modules, built in 44.92s |
| `npm run test -- --run src/tests/architect/protectionPartitionValidator.test.ts` | ✅ 29/29 tests pass                     |
| Re-run exclusivity tests (9 files, 102 tests)                                    | ✅ All pass, zero regressions           |

### Exclusivity regression tests:

- `entitlementExclusivityValidator.test.ts` — 26 tests ✅
- `saveEntitlementExclusivity.test.ts` — 9 tests ✅
- `tradeEntitlementExclusivity.test.ts` — 6 tests ✅
- `tradeEntitlementExclusivity.unavailable.test.ts` — 4 tests ✅
- `vacuumTransferExclusivityGate.test.ts` — 7 tests ✅
- `worldTradeApplyExclusivityGate.test.ts` — 6 tests ✅
- `dareMutatorExclusivityGate.test.ts` — 5 tests ✅
- `tradeEntitlementRouting.test.ts` — 16 tests ✅
- `computeEntitlementClaims.test.ts` — 23 tests ✅

---

## Intentionally Skipped

| Command             | Reason                                                              |
| ------------------- | ------------------------------------------------------------------- |
| `npm run lint`      | Pre-existing ~1888 errors; no new lint issues introduced            |
| `npm run test:full` | Per AGENTS.md policy, full suite requires explicit `RUN FULL SUITE` |

---

## Architecture Notes

### Rule #5 Integration

Rule #5 is **not** a standalone check — it is integrated into the Rule #1 decision path within `validateEntitlementExclusivity()`. When two `pick_ownership` entitlements share the same `underlyingPickId`:

1. `checkProtectionPartitionPair(a, b)` is called first
2. If `VALID_PARTITION` → Rule #1 is **suppressed** (no violation)
3. If `OVERLAP` → `OVERLAP_PROTECTION_RANGE` is emitted instead of `DUP_PICK_OWNERSHIP_UNDERLIER`
4. If `UNAVAILABLE` → falls through to existing `DUP_PICK_OWNERSHIP_UNDERLIER` (fail-closed)

This design ensures backward compatibility: existing entitlements without `structuredCondition` continue to be validated by the original Rule #1.

### Auto-Population

`buildProtectionLadder()` now auto-derives `structuredCondition` from condition strings:

- `"Top 10"` → `{ positionStart: 1, positionEnd: 10 }`
- `"Lottery"` → `{ positionStart: 1, positionEnd: 14 }`
- `"Unprotected"` → no structuredCondition (threshold is null)

Custom ranges (e.g., `{ positionStart: 11, positionEnd: 30 }`) must be set via the editor UI.

---

## Master Doc Update

§10.10 added to `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md` — covers purpose, schema, rule table update, decision logic, examples, invariants, and file reference.
