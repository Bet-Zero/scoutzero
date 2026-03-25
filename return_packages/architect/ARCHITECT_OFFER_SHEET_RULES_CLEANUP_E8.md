# ARCHITECT_OFFER_SHEET_RULES_CLEANUP_E8

**Date:** 2026-03-24
**Scope:** Offer-sheet validator rules cleanup — 48-hour window hardening + stale stub message removal
**Status:** COMPLETE

---

## Summary

Two validator-level inconsistencies identified in the master doc (`ARCHITECT_CONTRACT_FLOW_REVIEW.md`) findings table after E3–E7 are now resolved:

1. **48-hour match window promoted to hard blocking violation.** A late `matchOfferSheet` attempt now returns `valid: false` and cannot persist. Previously it emitted a warning and allowed the match to proceed.

2. **`rfa_offer_sheet_stub_active` removed entirely.** The warning said "Full match/decline workflow not yet implemented" — this was false. All compute paths (`computeMatchOfferSheetResult`, `computeFinalizeMatchedOfferSheetResult`, etc.) are fully implemented. The message fired unconditionally for every offer-sheet path regardless of status. It has been deleted with no replacement.

---

## Files Changed

| File | Change |
|---|---|
| `src/features/architect/utils/capLegalityValidation.ts` | 3 edits |
| `src/features/architect/utils/validatePhase21.test.ts` | 1 edit (test 4) |
| `tests/architect/capLegalityValidation.test.js` | 5 sites cleaned |

---

## Root Cause

Both issues were introduced during phased implementation:

- `rfa_offer_sheet_stub_active` was added in Phase 12/13 as a temporary UI-awareness stub when the match/decline resolution workflow was not yet implemented. The workflow was completed in later phases but the stub warning was never removed.
- The 48-hour window was added in Phase 21 as a warning-only rule (`// Warning only` comment in-code). The master doc had this marked as a "Confirmed risk" finding with a recommended fix to promote it to a blocking violation.

Neither issue was an architecture problem — both were narrow, localized validator inconsistencies.

---

## 48-Hour Rule Decision: Hard Block

**Decision:** Treat as hard blocking violation.

**Rationale:** The master doc explicitly marks the warning-only 48-hour window as a "Confirmed risk" with the note: "If the product expects the 48-hour window to be a real rule, the current authoritative layer does not enforce it." There is no codebase evidence that the window should be advisory-only (no feature flag, no explicit product note). The default assumption in the E8 execution prompt is to treat it as a hard rule unless evidence indicates otherwise.

**Mechanism:** `validateOfferSheetResolution` already returns `valid: violations.length === 0`. Moving `offer_sheet_window_expired` from `warnings.push` to `violations.push` is the complete change. The existing `validateMutation('matchOfferSheet')` machinery gates on `result.valid` with no additional changes needed in `mutationPipeline.ts`.

---

## Before vs. After Behavior

### 48-hour window

| Scenario | Before E8 | After E8 |
|---|---|---|
| Late match (`asOfDate > cutoff`) | `valid: true`, warning emitted | `valid: false`, violation emitted, mutation blocked |
| On-time match | `valid: true`, no warning | `valid: true`, no violation |
| Decline (any date) | `valid: true`, no warning | Unchanged — deadline does not apply to declines |
| Missing `asOfDate` | No check performed | Unchanged — no check without a date |

### `rfa_offer_sheet_stub_active`

| Scenario | Before E8 | After E8 |
|---|---|---|
| Any `rfaOfferSheet=true` signing path | Warning emitted with "stub mode" message | No warning emitted |
| `SOFT_WARNING_RULES` array | Contained `'rfa_offer_sheet_stub_active'` | Entry removed |

---

## Messaging Changes

**Removed message:** `rfa_offer_sheet_stub_active`
- Old: `"RFA offer sheet processing is in stub mode (Phase 13). Status: "${status}", Finalizing: ${finalizing}. Full match/decline workflow not yet implemented."`
- New: Nothing — the rule no longer fires.

**Updated message:** `offer_sheet_window_expired`
- Old: `severity: 'warning'` in `warnings[]`
- New: `severity: 'error'` in `violations[]`
- Message text unchanged: `"48-hour match window expired on ${cutoff} (As of: ${asOfDate})."`

**Updated comment in source:** `// Phase 21: Check 48-hour window (Warning only)` → `// Phase 21: Check 48-hour window (blocking violation — late match is not allowed)`

---

## Validation Alignment Proof

### Apply-time (authoritative layer)

`validateOfferSheetResolution` is the single enforcement point for `matchOfferSheet`. Its return flows directly through `validateMutation`:

```typescript
case 'matchOfferSheet': {
  const result = validateOfferSheetResolution({ ...action: 'match', asOfDate });
  return {
    valid: result.valid,           // false when window expired (E8)
    error: result.violations[0]?.message || null,
    violations: result.violations.map(...),
    warnings: [...result.warnings, ...pipelineWarnings],
  };
}
```

After E8, `result.valid` is `false` when the window has expired. `applyWorldMutation` receives a failed validation and returns an error to the caller. The match does not persist.

### Preflight layer

There is no separate preflight path for `matchOfferSheet`, `declineOfferSheet`, or `finalizeMatchedOfferSheet` — these are direct home-team actions from `OfferSheetList` buttons. The mutation-layer enforcement is the authoritative enforcement path. This is the correct architecture.

The `storeOfferSheet` preflight (`preflightOfferSheetMutation`) is unaffected — it calls `validateSigning` (not `validateOfferSheetResolution`) and the 48-hour window check only applies to the match action.

### `rfa_offer_sheet_stub_active` elimination

The warning was emitted unconditionally in `validateSigning` after all Case A/B/C checks for the offer-sheet path. Removing the push block eliminates all emission sites. No call sites in `mutationPipeline.ts`, `useCapValidation.ts`, `OfferSheetList.tsx`, or any UI file consume this rule code by name.

---

## Preflight Alignment Proof

The offer-sheet preflight (`preflightOfferSheetMutation`) calls `validateSigning` with `rfaOfferSheet: true, rfaOfferSheetOnly: true`. This path was affected by the `rfa_offer_sheet_stub_active` removal: the stub warning no longer appears in preflight results. Since the stub carried no actionable information (it was stale informational text), its removal does not change preflight `status`, `reasons`, or meaningful `warnings`. The modal `useCapValidation` integration path is unaffected.

E6/E7 preflight paths (SAT, offer-sheet store) are unaffected by both changes.

---

## Tests Added/Updated

### Updated: `src/features/architect/utils/validatePhase21.test.ts`

- **Test 4** renamed: `'4. should warn if matching on day 4'` → `'4. should block if matching on day 4'`
- `expect(result.valid).toBe(true)` → `expect(result.valid).toBe(false)`
- `expect(result.warnings.some(w => w.rule === 'offer_sheet_window_expired')).toBe(true)` → `expect(result.violations.some(v => v.rule === 'offer_sheet_window_expired')).toBe(true)`
- New assertion: `expect(result.warnings.some(w => w.rule === 'offer_sheet_window_expired')).toBe(false)` (confirms rule is not in warnings)

Tests 1–3, 5, 6 unchanged — all assert the rule does not appear in `warnings` when window is open or action is not `match`, which remains correct.

### Cleaned: `tests/architect/capLegalityValidation.test.js`

5 sites removed:
- **Site 3A:** Removed stub assertion from "allows offer sheet attempt when rfaOfferSheet === true and terms valid (with MATCHED status)" test
- **Site 3B:** Deleted entire `it('emits stub_active warning for all processed offer sheets', ...)` test block
- **Site 3C:** Deleted `it('confirms rfa_offer_sheet_stub_active is SOFT_WARNING', ...)` from Phase 12 Rule ID Confirmation
- **Site 3D:** Removed 3-line stub assertion block from "allows PENDING_MATCH when rfaOfferSheetOnly === true" test
- **Site 3E:** Deleted `it('confirms rfa_offer_sheet_stub_active is SOFT_WARNING', ...)` from Phase 13 Rule ID Confirmation

---

## Validation Results

```
npm run typecheck          → PASSED (0 errors)
validatePhase21.test.ts    → 10/10 passed
capLegalityValidation.test.js → 239/239 passed (both root + src/tests copies)
npm run build              → PASSED (pre-existing chunk size and dynamic/static import warnings only; no new warnings)
```

---

## No-Regression Proof

- E4 finalize flows: `validateOfferSheetResolution(action='finalize')` path is unaffected — 48-hour check only fires for `action === 'match'`
- E5 store behavior: `validateSigning` / `storeOfferSheet` path unaffected — stub removal and window change don't touch store-path logic
- E6 SAT preflight: completely independent path
- E7 offer-sheet preflight: `preflightOfferSheetMutation` → `validateSigning` — stub removal means preflight no longer surfaces `rfa_offer_sheet_stub_active` in warnings (correct; it was stale)

---

## Remaining Follow-Up

**Offer-sheet UI initiation preflight drift** (Stage 1 of lifecycle map, `ARCHITECT_CONTRACT_FLOW_REVIEW.md` row — `Confirmed risk`):

The modal still computes legality for the `signNew`/offer-sheet path from `contractDataForValidation`, which does not include `rfaOfferSheet`, `rfaOfferSheetOnly`, or `rfaOfferSheetStatus` flags. The authoritative preflight (`preflightOfferSheetMutation`) is now wired for the offer-sheet checkbox path (E7), but the generic `signNew` preflight still runs in parallel without canonical offer-sheet context.

This is the only remaining trust gap in the offer-sheet flow.
