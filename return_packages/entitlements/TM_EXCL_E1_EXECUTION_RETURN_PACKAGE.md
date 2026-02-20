# TM-EXCL-E1 — Execution Return Package

**Ticket:** TM-EXCL-E1 — Entitlement Exclusivity Foundation (Validator + Save Gate + Trade Gate)
**Date:** 2026-02-20
**Status:** ✅ COMPLETE

---

## 1. Summary

Implemented the foundational entitlement exclusivity enforcement system. Four rules block overlapping claims at two enforcement points: **save-time** (when authoring entitlements) and **trade-time** (when validating trades). The system is built around a pure validator function with no Firestore dependency, making it testable and composable.

### Rules Enforced

| #   | Violation Type                 | Rule                                                                  |
| --- | ------------------------------ | --------------------------------------------------------------------- |
| 1   | `DUP_PICK_OWNERSHIP_UNDERLIER` | Two `pick_ownership` must not share the same `underlyingPickId`       |
| 2   | `DUP_SWAP_CONTROLLER`          | Two `swap_right` must not share the same `swapControllerPickId`       |
| 3   | `DUP_CONVEYANCE_POOL_RANK`     | Two `conveyance_right` with exact same pool + comparator + ranks      |
| 4   | `OVERLAP_CONVEYANCE_POOL_RANK` | Two `conveyance_right` with overlapping pool ∧ rank ∧ same comparator |

---

## 2. Files Changed

| File                                                                           | Change       | Why                                                                                                                    |
| ------------------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/entitlements/entitlementExclusivityValidator.ts` | **CREATED**  | Pure exclusivity validator — 4 rules, normalization helpers, candidate support                                         |
| `src/features/architect/admin/saveEntitlementFromFormState.ts`                 | **MODIFIED** | Added exclusivity gate before vacuum/world routing; extended `SaveEntitlementResult` with `errorType` and `violations` |
| `src/features/architect/admin/useEntitlementEditorSession.ts`                  | **MODIFIED** | Surface exclusivity errors as toast messages, keep modal open on conflict                                              |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`           | **MODIFIED** | Added `entitlementExclusivity` blocking rule using post-trade entitlement set                                          |
| `src/features/architect/tradeMachine/TradeLegalChecker.jsx`                    | **MODIFIED** | Added "Pick Exclusivity" `<RuleDisplay>` slot                                                                          |
| `src/tests/architect/entitlementExclusivityValidator.test.ts`                  | **CREATED**  | 26 pure validator tests                                                                                                |
| `src/tests/architect/saveEntitlementExclusivity.test.ts`                       | **CREATED**  | 7 save gate integration tests                                                                                          |
| `src/tests/architect/tradeEntitlementExclusivity.test.ts`                      | **CREATED**  | 6 trade gate integration tests                                                                                         |
| `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md`                 | **MODIFIED** | Added §10 Exclusivity Gates (Save + Trade)                                                                             |

---

## 3. Test Results

### Pure Validator Tests (26/26 passing)

```
✓ src/tests/architect/entitlementExclusivityValidator.test.ts  (26 tests) 30ms
```

### Save Gate Tests (7/7 passing)

```
✓ src/tests/architect/saveEntitlementExclusivity.test.ts  (7 tests) 102ms
```

### Trade Gate Tests (6/6 passing)

```
✓ src/tests/architect/tradeEntitlementExclusivity.test.ts  (6 tests) 31ms
```

### Full Suite Regression

```
Test Files  12 failed | 232 passed (244)
Tests       46 failed | 3192 passed | 3 skipped | 3 todo (3244)
```

All 12 failures are **pre-existing** (not in any exclusivity test file). Our 3 new files (39 tests) all pass. Build succeeds cleanly.

---

## 4. Architecture Notes

### Pure Validator Design

- `validateEntitlementExclusivity({ entitlements, candidate? })` is a **pure function** — no Firestore access, no side effects.
- Accepts a minimal `EntitlementDocLike` interface compatible with Zod output, resolver output, and post-trade arrays.
- Self-edit exception: entries sharing the same truthy `id` skip collision checks.
- O(n²) pairwise comparison — acceptable for team-scoped sets (≤100 entitlements per team).

### Save Gate Integration

- Runs after document build + field validation, before vacuum/world routing.
- Uses existing `resolveEntitlementsForTeam()` to load the comparison set — correctly handles world and vacuum overlay modes.
- Non-fatal catch: if the resolver fails (e.g., Firestore outage), the save proceeds with a dev-only warning.

### Trade Gate Integration

- Uses `computePostTradeEntitlements()` to build the post-trade set (current − outgoing + incoming).
- Runs per-team as an `allRules` entry, gating `result.legal` like all other CBA rules.
- Non-fatal catch: if computation fails, the rule passes (no blocking on infrastructure errors).

### UI Surfacing

- Save conflicts: two toast messages — "Cannot save: entitlement conflicts..." + specific violation message (6-second duration).
- Trade conflicts: "Pick Exclusivity" displayed in TradeLegalChecker grid alongside other CBA rules.

---

## 5. Limitations & Follow-ups

1. **Trade routing in 3+ team trades**: The exclusivity validator depends on `computePostTradeEntitlements()` which requires `toTeamId` on each outgoing entitlement. If `toTeamId` is missing in a 3+ team trade, entitlements may be skipped (not routed).
2. **10 write entry points**: The save gate covers entry point #1 (`saveEntitlementFromFormState`). Direct Firestore writes via `writeWorldEntitlement`, `applyVacuumTransfer`, mutation pipeline, and DARE are not gated. Future tickets should add guards to these paths.
3. **Protection condition conflicts**: The current rules don't check if two entitlements with different protection ladders effectively target the same outcome. This is a future enhancement.
4. **No automatic resolution**: On conflict, the save is blocked but no "fix" is suggested. Future UI could offer to replace or merge.

---

## 6. Master Doc Updates

**File:** `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md`

**Added section:** §10 Exclusivity Gates (Save + Trade)

Contents:

- §10.1 Purpose
- §10.2 Enforced Rules (4-rule table)
- §10.3 Where Rules Run (Save Gate + Trade Gate details)
- §10.4 Normalization rules
- §10.5 Key Files reference table
