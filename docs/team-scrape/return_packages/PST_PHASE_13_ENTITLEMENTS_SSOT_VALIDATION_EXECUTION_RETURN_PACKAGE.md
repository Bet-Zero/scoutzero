# PST Phase 13 — Entitlements SSOT Validation Execution Return Package

**MODE**: EXECUTION (MUTATIONS APPLIED)  
**DATE**: 2026-02-01  
**STATUS**: COMPLETE  
**MASTER DOC**: [PST_PICK_LEDGER_MASTER_PLAN.md](../PST_PICK_LEDGER_MASTER_PLAN.md)

---

## Summary

Phase 13 established **entitlements as the authoritative SSOT** for draft-asset validation (Stepien baseline) and added guardrails for future deprecation of legacy pick fields.

**CRITICAL CHANGE**: Stepien baseline **no longer reads `draftPicksObligations`** anywhere. All baseline derivation now uses `validationEntitlements` exclusively.

---

## A. What Changed

### 1. Stepien Validation (SSOT Migration)

**File**: `src/features/architect/utils/tradeMachine/rules/validateStepien.js`

| Change                  | Description                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------- |
| Removed legacy fallback | `draftPicksObligations` is no longer read for baseline                                 |
| SSOT baseline           | `buildStepienBaselinePicksFromEntitlements(validationEntitlements)` is always used     |
| Empty baseline handling | If `validationEntitlements` is empty, baseline is empty (team has full pick inventory) |
| Debug output update     | `_debug.useEntitlementBaseline` → `_debug.baselineSource: 'entitlements_ssot'`         |
| Deprecated helper       | `obligationReservesYear()` marked as `@deprecated` (no longer called)                  |

**Before (Phase 12.2)**:

```javascript
if (useEntitlementBaseline) {
  // Use entitlements
} else {
  // Fallback to draftPicksObligations
}
```

**After (Phase 13)**:

```javascript
// Phase 13: Always use entitlements SSOT
const baselinePicks = buildStepienBaselinePicksFromEntitlements(
  validationEntitlements
);
```

### 2. Schema Deprecation Markers

**File**: `src/schemas/architect.ts`

Added JSDoc `@deprecated` annotations to:

| Field                   | Deprecation Note                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `draftPicksInventory`   | Legacy field. Draft assets SSOT is entitlements. No longer kept in sync by trades. |
| `draftPicksObligations` | Legacy field. Stepien baseline now derived from entitlements.                      |
| `draftPicksContested`   | Legacy field. Swap/conveyance info lives in entitlement definitions.               |

**No fields were removed** - deprecation markers only. Runtime behavior unchanged.

### 3. Guardrail Tests for entitlementIds Transfer

**File**: `src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.js` (NEW)

| Test Suite                  | Cases | Description                                                |
| --------------------------- | ----- | ---------------------------------------------------------- |
| 2-Team Trade                | 2     | Basic entitlement transfer + bidirectional exchange        |
| 3-Team Routed (toTeamId)    | 2     | Routed entitlements go only to target team                 |
| 3-Team Unrouted (Broadcast) | 2     | Unrouted entitlements broadcast to all participants        |
| Edge Cases                  | 3     | Empty/missing entitlementsOut, entitlementId field support |

All 9 tests pass ✅

---

## B. Files Changed/Created

| File                                                                    | Action   | Purpose                                  |
| ----------------------------------------------------------------------- | -------- | ---------------------------------------- |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js`    | MODIFIED | Remove legacy fallback, SSOT baseline    |
| `src/schemas/architect.ts`                                              | MODIFIED | Add @deprecated markers                  |
| `src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.js` | CREATED  | Guardrail tests for entitlement transfer |
| `tests/validators/stepienEntitlements.test.js`                          | MODIFIED | Update test for Phase 13 behavior        |
| `tests/validators/stepienEntitlementBaseline.test.js`                   | MODIFIED | Update tests for Phase 13 SSOT           |
| `src/tests/tradeMachine/stepienObligations.test.js`                     | REPLACED | Rewrote entire file for Phase 13 SSOT    |

---

## C. Test Results

### Build

```
✓ built in 41.51s
```

### Stepien Tests

```
✓ tests/validators/stepien.test.js (14 tests)
✓ tests/validators/stepienEntitlements.test.js (28 tests)
✓ tests/validators/stepienEntitlementBaseline.test.js (19 tests)
✓ src/tests/tradeMachine/stepienObligations.test.js (16 tests)
✓ src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.js (9 tests)
```

**Total: 86 tests passed** ✅

---

## D. Known Limitations

### 1. Season Manager Still Legacy

`src/features/architect/utils/seasonManager.js` operates on legacy `draftPicks` field only. Season advancement/resolution is **not** entitlement-aware.

**Impact**: After season advance, entitlement state may need manual reconciliation or a future phase to wire entitlements into season resolution.

### 2. Legacy Fields Not Deleted

`draftPicksInventory`, `draftPicksObligations`, `draftPicksContested` still exist in the schema and Firestore documents. They are:

- Marked as `@deprecated` ✅
- No longer read by Stepien validation ✅
- Still written to by base team hydration (not mutation pipeline)
- **Not removed** to preserve backward compatibility and rollback capability

### 3. Trade Machine Still Writes Both

`executeTrade` in `tradeContext.js` correctly updates BOTH:

- `entitlementIds` (SSOT) ✅
- `draftPicks` (legacy compatibility) ✅

This dual-write continues to support legacy consumers during transition.

---

## E. Acceptance Criteria Status

| Criteria                                                              | Status                 |
| --------------------------------------------------------------------- | ---------------------- |
| Stepien baseline does not read `draftPicksObligations` anywhere       | ✅ COMPLETE            |
| All Stepien tests pass (legacy + entitlement suites)                  | ✅ COMPLETE (86 tests) |
| New Phase 13 entitlementIds transfer guardrail passes (incl. routing) | ✅ COMPLETE (9 tests)  |
| Build passes                                                          | ✅ COMPLETE            |
| Schema fields annotated as deprecated (no deletions)                  | ✅ COMPLETE            |
| Return package + master doc updated                                   | ✅ COMPLETE            |

---

## F. Explicit Statement

**Stepien baseline no longer reads `draftPicksObligations`.**

The Stepien Rule validation in `validateStepien.js` now exclusively uses `validationEntitlements` (via `buildStepienBaselinePicksFromEntitlements()`) to determine what years a team controls. The legacy `draftPicksObligations` field is completely ignored for baseline derivation.

If `validationEntitlements` is empty or not provided, the baseline is empty, meaning the team is assumed to have full control of all their draft picks (no years reserved by prior obligations).

---

**END OF RETURN PACKAGE**
