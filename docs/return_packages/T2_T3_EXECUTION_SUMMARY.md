# T-2 + T-3 EXECUTION SUMMARY

**Date:** 2026-02-05
**Scope:** T-2 (2nd-apron TPE validator fix) + T-3 (extensions display + stale warning cleanup)
**Status:** COMPLETE — all acceptance criteria met

---

## What Changed

| File | Edit |
|------|------|
| `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js` | Deleted the `else` branch (lines 61-64) that blanket-blocked current-year TPEs for 2nd-apron teams. Removed now-unused `SECOND_APRON_TPE_BLOCKED` import. Only the `hasPriorYearTPE` guard remains inside the 2nd-apron check. |
| `src/features/architect/utils/mutationPipeline.js` | In `computeExtensionResult` (lines 1742+): before merging extension salary rows, compute an `extensionYearSet` from the new extension years, then `.map()` over the existing `salariesByYear` marking any row whose year falls in that set as `voidedByExtension: true`. Extension rows themselves retain `isExtensionSeason: true` and are never voided. |
| `src/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerContractMini.jsx` | Thread `voidedByExtension` from salary data into `displaySeasons`. In render: voided rows get `opacity-30 line-through` on the row div and display an italic "Voided" label instead of the salary amount. |
| `src/features/architect/tradeMachine/utils/entitlementWarnings.js` | Removed Warning B block: the `hasStepienWarning` flag, the `if (!hasStepienWarning && entitlement.round === 1 ...)` guard, and the `warnings.push(...)` call. Updated JSDoc to remove the Warning B line. |
| `tests/trade/secondApron_tpeBan.test.js` | Renamed second test to `'does not block current-year TPEs for second-apron teams'`. Assertion now verifies that `tradeExceptions` rule passes and no TPE-specific violation appears. (Salary matching is a separate concern exercised when the trade actually routes salary — this test isolates the TPE validator.) |
| `tests/architect/extension_voidedByExtension.test.js` | **New file.** 3 unit tests via `computeWorldMutation({ mutationType: 'extendPlayer' })`: overlapping years voided, non-overlapping years untouched, season-string format overlap correctly detected. |
| `tests/architect/PlayerContractMini.voidedByExtension.test.jsx` | **New file.** 4 rendering tests: "Voided" label present when flag set, absent when not set, correct CSS classes applied to the row, salary hidden for voided rows while non-voided rows still render. |

---

## Root Cause + Fix — T-2 (2nd-Apron TPE Validator)

**Root cause:** `validateTradeExceptions.js:61-64` had an `else` branch after the `hasPriorYearTPE` check that pushed `SECOND_APRON_TPE_BLOCKED` for any TPE that was NOT prior-year — i.e. it blanket-blocked current-year TPEs too. Per CBA, only prior-year TPEs are restricted for 2nd-apron teams. `getIncomingCeiling()` and `basicRules.js` were both correct; this was the lone divergent enforcement point.

**What was done:** Deleted the three-line `else` block. Removed the now-dead `SECOND_APRON_TPE_BLOCKED` import. The `if (hasPriorYearTPE)` guard is the sole remaining check inside the 2nd-apron TPE path.

---

## Root Cause + Fix — T-3A (Extensions Display)

**Root cause:** `computeExtensionResult` in `mutationPipeline.js` concatenated extension salary rows onto the existing `salariesByYear` array without marking the original rows that overlap in year. The schema field `voidedByExtension` existed in `BasePlayerContractYearZ` but was never written. `PlayerContractMini` had no rendering path for it. Result: a player with an extension showed both the old and new salary for the same year with no visual distinction.

**What was done:** Before the concat, compute a `Set` of extension years. Map over existing rows: any row whose year is in the set gets `voidedByExtension: true`. In `PlayerContractMini`, voided rows are dimmed (`opacity-30 line-through`) and labelled "Voided" rather than showing the stale salary amount.

---

## Root Cause + Fix — T-3B (Stale Stepien Warning)

**Root cause:** `entitlementWarnings.js:72-84` emitted "Stepien Rule not yet enforced for entitlements" for any first-round entitlement trade. Stepien IS enforced — `validateStepien.js:145-147` reads `entitlementsOut` and runs the consecutive-year check. The warning predates Phase 12.2/13 completion and was simply never cleaned up.

**What was done:** Removed the Warning B `if` block, the `hasStepienWarning` flag, and the corresponding JSDoc line. No logic change — only dead advisory text removed.

---

## Test Results

### Target test files — 10/10 pass

| File | Tests | Result |
|------|-------|--------|
| `tests/trade/secondApron_tpeBan.test.js` | 3 (T-2 guard) | PASS |
| `tests/architect/extension_voidedByExtension.test.js` | 3 (new T-3A unit) | PASS |
| `tests/architect/PlayerContractMini.voidedByExtension.test.jsx` | 4 (new T-3A UI) | PASS |

### Broader suites — regressions confirmed absent

- `tests/architect/` (99 files): 91 passed, 8 failed — all 8 failures are in files not touched by T-2/T-3 (seasonManager, signAndTrade, offerSheet, renounceRights, integration, phase77 guardrails). These match the pre-existing failure set documented in TM-1.
- `tests/trade/` (38 files): 33 passed, 5 failed — same pre-existing set (staleValidationFix, TradeValidationGating, etc.). `secondApron_tpeBan.test.js` passes.
- Build: pre-existing syntax error in `TierMakerView.jsx:44` (not touched). All files touched by T-2/T-3 compile cleanly.

---

## Manual Smoke Checklist

| Check | Expected | Status |
|-------|----------|--------|
| 2nd-apron team + current-year TPE | `validateTradeExceptions` returns `passed: true`; no TPE violation in results | Verified via `secondApron_tpeBan.test.js` |
| 2nd-apron team + prior-year TPE | Blocked with `SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED` | Verified — first test case passes |
| Extension with overlapping years | Original year rows have `voidedByExtension: true` in persisted state | Verified via `extension_voidedByExtension.test.js` (3 cases) |
| PlayerContractMini renders voided rows | Dimmed + "Voided" label; non-voided rows show salary normally | Verified via `PlayerContractMini.voidedByExtension.test.jsx` (4 cases) |
| Stepien warning absent | No "not yet enforced" text emitted for first-round entitlements | Warning B code removed; no tests reference the removed message |
