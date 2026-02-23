# TM-EXCL-E4 — EXECUTION RETURN PACKAGE

**Ticket:** TM-EXCL-E4 — Claims Model + Explainability  
**Date:** 2026-02-20  
**Master Doc:** `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md` §10.9

---

## Summary

Added a canonical **Claims Model** that converts each entitlement into normalized claim fingerprints for explainability. Every exclusivity violation now carries claim-based explanations visible to end users in both the Entitlement Editor and the TradeLegalChecker.

---

## Files Changed

### New Files

| File                                                                    | Purpose                                                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/entitlements/computeEntitlementClaims.ts` | Pure claims model: `computeEntitlementClaims()`, `computeEntitlementClaimsBatch()`, `explainConflict()`, `CONFLICT_TYPE_LABELS` |
| `src/tests/architect/computeEntitlementClaims.test.ts`                  | 23 tests for the pure claims model                                                                                              |

### Modified Files

| File                                                                           | Change                                                                                                                                                                                              |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/entitlements/entitlementExclusivityValidator.ts` | Added `claimsA`, `claimsB`, `conflictExplanation` fields to `EntitlementViolation`. All 4 violation pushes now compute and attach claims.                                                           |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`           | Entitlement exclusivity result now passes claim details (`claimsA`, `claimsB`, `conflictExplanation`, `type`, `entitlementIds`) through to the rule result instead of only message strings.         |
| `src/features/architect/tradeMachine/TradeLegalChecker.jsx`                    | Pick Exclusivity failures now show an expandable detail section: conflict type label, reason, conflicting IDs, and claim explanation. Max 3 shown with overflow indicator.                          |
| `src/features/architect/admin/EntitlementEditorModal.tsx`                      | Added "Exclusivity Conflicts" display section below validation errors. Shows conflict type, reason, conflicting IDs, and claim explanation when save is blocked.                                    |
| `src/features/architect/admin/useEntitlementEditorState.ts`                    | Added pre-save exclusivity check with claim-based error messages. Exposes `exclusivityViolations` state for the modal to render. Uses `conflictExplanation` for error toast instead of raw message. |
| `src/tests/architect/entitlementExclusivityValidator.test.ts`                  | +1 new test ("all violations carry claims"). Added claims assertions to 4 existing violation detection tests. Total: 27 tests.                                                                      |
| `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md`                 | Added §10.9 "Claims Model + Explainability".                                                                                                                                                        |

---

## Validation Commands Run

| Command                                                                                     | Result          |
| ------------------------------------------------------------------------------------------- | --------------- |
| `npm run build`                                                                             | ✅ Pass (38.9s) |
| `npm run test -- --run src/tests/architect/computeEntitlementClaims.test.ts`                | ✅ 23/23 pass   |
| `npm run test -- --run src/tests/architect/entitlementExclusivityValidator.test.ts`         | ✅ 27/27 pass   |
| `npm run test -- --run src/tests/architect/saveEntitlementExclusivity.test.ts`              | ✅ 9/9 pass     |
| `npm run test -- --run src/tests/architect/tradeEntitlementExclusivity.test.ts`             | ✅ 6/6 pass     |
| `npm run test -- --run src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts` | ✅ 6/6 pass     |
| `npm run test -- --run src/tests/architect/vacuumTransferExclusivityGate.test.ts`           | ✅ 7/7 pass     |
| `npm run test -- --run src/tests/architect/worldTradeApplyExclusivityGate.test.ts`          | ✅ 6/6 pass     |
| `npm run test -- --run src/tests/architect/dareMutatorExclusivityGate.test.ts`              | ✅ 5/5 pass     |

### Commands Intentionally Skipped

- `npm run test:full` — Not authorized (no "RUN FULL SUITE" in prompt).
- `npm run lint` — Pre-existing tech debt (~1888 errors). No new lint rules introduced.

---

## Acceptance Criteria Checklist

| Criterion                                                          | Status                                                                                 |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Blocked save/trade shows explanation a non-technical user can read | ✅ `conflictExplanation` is human-readable, shown in both Editor and TradeLegalChecker |
| Explanation includes what was claimed                              | ✅ `claimsA[0].meta.explanation` shown (e.g., "Owns the LAL 2026 1st pick")            |
| Explanation includes what it conflicted with                       | ✅ `entitlementIds` shown with `↔` separator                                          |
| Claims are deterministic and stable                                | ✅ Same entitlement always produces same claims (tested)                               |
| No changes to exclusivity rules                                    | ✅ Only additive fields on violations; no rule logic changes                           |

---

## Architecture Notes

- **`computeEntitlementClaims()`** is pure: no Firestore, no side effects, no imports beyond the validator's `EntitlementDocLike` type.
- Claims use **identical normalization** as the exclusivity validator (pool sorting, rank parsing, comparator lowercasing).
- The `explainConflict()` function finds matching claim keys between two claim sets and produces a readable label. Falls back to `CONFLICT_TYPE_LABELS` if no key match.
- Violations are **backward-compatible**: `claimsA`, `claimsB`, and `conflictExplanation` are optional fields. Code that only reads `type`/`message`/`entitlementIds` is unaffected.
