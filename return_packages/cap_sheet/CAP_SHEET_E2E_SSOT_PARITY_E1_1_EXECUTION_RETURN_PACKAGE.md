# CAP_SHEET_E2E_SSOT_PARITY_E1_1 — Execution Return Package

**Date:** 2026-02-28
**Status:** COMPLETE
**Scope:** Gate confirmation, season advance validation unification, legacy deadCap normalization

---

## Summary

Three deliverables completed:

1. **Gate Confirmation** — Both `npm run test:ui` and `npm run test` pass under the repo's official split configs (34 files, 370 passed, 2 skipped in each).
2. **Season Advance Validation Unification** — Fixed hard cap ordering bug in OSTE and added `validateContractRows()` (shared with mutation pipeline) to `validateOffseasonState()`.
3. **Legacy deadCap Normalization** — `computeDeadMoneyForYear` now handles object-map `amountByYear` shapes inside `deadCap[]` items, eliminating the "needs re-save" residual risk from E1.

---

## Task 1: Gate Confirmation

| Command | Result |
|---------|--------|
| `npm run test:ui -- --run --reporter=dot` | **34 passed** (370 tests, 2 skipped) |
| `npm run test -- --run --reporter=dot` | **34 passed** (370 tests, 2 skipped) |

Both official repo scripts pass cleanly. No fixes needed.

---

## Task 2: Season Advance Validation Unification

### Statement

**Season advance does NOT use the same cap legality validator used by mutationPipeline — because no such shared holistic validator exists.**

### Evidence

The mutation pipeline's `validateMutation()` function (in `mutationPipeline.js`, line ~2210) is a **per-mutation-type router**:

| Mutation Type | Validator | Requires |
|--------------|-----------|----------|
| `executeTrade` | Pre-validated via Trade Machine context | Trade-specific inputs |
| `signFreeAgent` | `validateSigning()` | Team + player + contract + exception being used |
| `waivePlayer` | `validateWaive()` | Team + player + stretch params |
| `extendPlayer` | `validateExtension()` | Team + player + extension params |
| `optionDecision` | `validateOptionDecision()` | Original/updated team + player + decision |
| `setDeadCap` | `validateDeadCap()` | Dead cap array |
| `setExceptions` | `validateExceptions()` | Exceptions object |

There is **no** `validateTeamCapState()`, `validateCapLegality()`, or similar holistic function. Each validator requires mutation-specific inputs that make direct reuse in a "validate team after transition" context impossible without inventing a new abstraction.

### What was implemented

Instead of inventing a new validation regime (which the task explicitly prohibits), two concrete improvements were made using **existing shared validators**:

#### A. Hard cap ordering bugfix

**Before:** `clearHardCapState()` at OSTE step 7 deleted all hard cap flags. `validateOffseasonState()` at step 9 checked those flags — always finding them cleared. The hard cap violation check was **dead code**.

**After:** `preTransitionHardCapState` is captured before `clearHardCapState()` runs, then passed to `validateOffseasonState()`. The hard cap check now reads from the pre-transition snapshot.

File: `src/features/architect/utils/offseason/resolveOffseasonTransition.ts`

#### B. `validateContractRows()` integration

`validateContractRows()` from `capLegalityValidation.js` is the same contract row schema validator that the mutation pipeline calls on every signing (`validateSigning`, line ~2239). It is now called for every remaining player inside `validateOffseasonState()`, ensuring post-transition contract data integrity.

File: `src/features/architect/utils/offseason/resolveOffseasonTransition.ts`

### Shared validator coverage comparison (post-E1.1)

| Validator | Season Advance | Mutation Pipeline |
|-----------|----------------|-------------------|
| `validateOptionDecision()` | ✅ (per option in OSTE) | ✅ |
| `validateExceptions()` | ✅ (in `validateOffseasonState`) | ✅ |
| `validateContractRows()` | ✅ **NEW E1.1** | ✅ |
| `computeTeamCapTotals()` | ✅ (twice: OSTE step 8 + seasonManager step 5) | ✅ |
| `isCapHoldAmountValid()` | ✅ (in `validateOffseasonState`) | ✅ |
| Hard cap ceiling check | ✅ **FIXED E1.1** (was dead code) | ✅ |
| `assertPersistableOrThrow()` | ✅ (bridge gate from E1) | ✅ |
| `sanitizeTransientFieldsForPersistence()` | ✅ (bridge gate from E1) | ✅ |
| `validateSigning()` | ❌ (N/A — no signing during advance) | ✅ |
| `validateWaive()` | ❌ (N/A — no waive during advance) | ✅ |
| `validateExtension()` | ❌ (N/A — no extension during advance) | ✅ |
| `validateExceptionEligibility()` | ❌ (N/A — no exception usage during advance) | ✅ |

The ❌ items are per-mutation validators that require action-specific inputs. They are architecturally N/A for season advance (no signing/waive/extension is happening during transition).

---

## Task 3: Legacy deadCap Normalization

### Problem

`computeDeadMoneyForYear()` expected `deadCap[].amountByYear` to be an array. If a pre-fix ManageDeadMoneyModal wrote it as an object-map (`{ 2026: 5000000 }` or `{ "2025-26": { amount: 3000000 } }`), the `Array.isArray()` check failed, `hasCoverage` stayed false, and the dead money was invisible in SSOT totals.

### Solution

Added inline normalization in `computeDeadMoneyForYear()` that handles three legacy object-map variants:

- `{ 2026: 5000000 }` (numeric key, flat value)
- `{ 2026: { amount: 3000000 } }` (numeric key, nested object)
- `{ "2025-26": 2000000 }` (season-format string key, flat value)

File: `src/features/architect/utils/capTotals/computeTeamCapTotals.js`

### Test proof

4 new tests in `src/tests/architect/capTotals/deadMoney_modal_schema_parity.test.js`:

| Test | What it proves |
|------|---------------|
| TEST 8 | `{ 2026: 5000000 }` flat object-map → counted in totals |
| TEST 9 | `{ 2026: { amount: 3000000 } }` nested object-map → counted in totals |
| TEST 10 | `{ "2025-26": 2000000 }` season-format key → counted in totals |
| TEST 11 | Mixed canonical array + legacy object-map items → both counted |

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/architect/utils/offseason/resolveOffseasonTransition.ts` | Added `validateContractRows` import; captured `preTransitionHardCapState` before `clearHardCapState`; passed it to `validateOffseasonState`; added `validateContractRows` loop for all remaining players in `validateOffseasonState` |
| `src/features/architect/utils/capTotals/computeTeamCapTotals.js` | Added object-map normalization branch in `computeDeadMoneyForYear` (handles numeric, string, and season-format keys + flat/nested values) |
| `src/tests/architect/oste_validation_unification_e1_1.test.js` | **NEW** — 7 tests (4 source-scan + 3 behavioral) for OSTE validation unification |
| `src/tests/architect/capTotals/deadMoney_modal_schema_parity.test.js` | Extended — 4 new tests (TEST 8–11) for legacy object-map normalization |

---

## Validation Commands + Results

```
npm run test:ui -- --run --reporter=dot
  Test Files  34 passed (34)
       Tests  370 passed | 2 skipped (372)

npm run test -- --run --reporter=dot
  Test Files  34 passed (34)
       Tests  370 passed | 2 skipped (372)

npm run build
  ✓ built in 35.40s (no errors)

npm run validate:project
  ✅ All validations passed!
```

---

## Residual Notes

1. **No holistic cap legality validator exists** in either path. The mutation pipeline validates per-action (sign, trade, waive, etc.) with action-specific inputs. Creating a shared `validateTeamCapState()` abstraction would require a new design effort and is outside E1.1 scope.

2. **Salary floor validation** is absent from both mutation pipeline AND season advance. Neither path checks the 90% minimum team salary rule. This is a known gap across the entire validation architecture.

3. **Exception eligibility (apron-based blocking)** is validated per-signing in the mutation pipeline via `validateExceptionEligibility()`. It is not relevant during season advance because no signing occurs — OSTE just resets exceptions for the new season via `resetTeamNonTpeExceptionsForNewSeason()`.
